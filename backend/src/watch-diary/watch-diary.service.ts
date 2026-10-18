import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserMovieService } from '../user-movie/user-movie.service';
import type { Prisma } from '../generated/prisma/client';
import { WatchStatus } from '../generated/prisma/enums';
import { lockResource } from '../common/utils/transaction-lock';
import { invalidateDataCache } from '../common/utils/data-revision';
import { movieTitleFilter } from '../common/utils/movie-title-filter';
import { normalizeMovieTitle } from '../common/utils/normalize-movie-title';
import { ZonedCalendar } from '../common/utils/timezone';
import { normalizeDiaryValues } from './diary-values';
import type {
  CreateDiaryInput,
  UpdateDiaryInput,
  DiaryQuery,
  DiaryPage,
  DiarySaveResult,
  DiaryEntryResponse,
} from './diary.types';

const diaryInclude = (userId: string) =>
  ({
    movie: {
      include: {
        poster: true,
        userMovies: { where: { userId }, select: { id: true }, take: 1 },
      },
    },
  }) as const;
type DiaryRow = Prisma.WatchEntryGetPayload<{
  include: ReturnType<typeof diaryInclude>;
}>;

@Injectable()
export class WatchDiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collection: UserMovieService,
  ) {}

  private entry(row: DiaryRow): DiaryEntryResponse {
    const movie = row.movie;
    if (!movie) throw new NotFoundException('Произведение не найдено');
    return {
      id: row.id,
      viewedOn: row.viewedOn.toISOString().slice(0, 10),
      scope: row.scope as 'TITLE' | 'SEASON',
      season: row.season,
      isRewatch: row.isRewatch,
      rating: row.rating,
      note: row.note,
      revision: row.revision,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      inCollection: movie.userMovies.length > 0,
      movie: {
        id: movie.id,
        title: movie.title,
        titleEn: movie.titleEn,
        isSerial: movie.isSerial,
        seasonCount: movie.seasonCount,
        contentKind: movie.contentKind,
        publishDate: movie.publishDate?.toISOString() ?? null,
        imageUrl: movie.poster?.thumbnailUrl || movie.poster?.url || null,
      },
    };
  }

  private async calendar(
    userId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<ZonedCalendar> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return new ZonedCalendar(user.timezone);
  }

  public async list(userId: string, query: DiaryQuery): Promise<DiaryPage> {
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException('Начало периода позже окончания');
    const calendar = await this.calendar(userId);
    const dateCalendar = new ZonedCalendar('UTC');
    const from = query.from ? dateCalendar.startOfDay(query.from) : undefined;
    const to = query.to ? dateCalendar.startOfDay(query.to) : undefined;
    const q = query.q?.trim() || undefined;
    const where: Prisma.WatchEntryWhereInput = {
      userId,
      deletedAt: null,
      ...(query.movieId ? { movieId: query.movieId } : {}),
      ...(query.isRewatch !== undefined ? { isRewatch: query.isRewatch } : {}),
      ...(from || to ? { viewedOn: { gte: from, lte: to } } : {}),
      ...(q ? { movie: movieTitleFilter(q) } : {}),
    };
    const pattern = q ? '%' + q + '%' : null;
    const alias = q ? normalizeMovieTitle(q) : null;
    return this.prisma.$transaction(
      async (tx) => {
        const [stats] = await tx.$queryRaw<
          { entries: number; titles: number; rewatches: number }[]
        >`
        SELECT count(*)::int AS entries, count(DISTINCT w.movie_id)::int AS titles,
          count(*) FILTER (WHERE w.is_rewatch)::int AS rewatches
        FROM watch_entries w JOIN movies m ON m.id = w.movie_id
        WHERE w.user_id = ${userId} AND w.deleted_at IS NULL
          AND (${query.movieId ?? null}::text IS NULL OR w.movie_id = ${query.movieId ?? null})
          AND (${query.isRewatch ?? null}::boolean IS NULL OR w.is_rewatch = ${query.isRewatch ?? null})
          AND (${from ?? null}::date IS NULL OR w.viewed_on >= ${from ?? null}::date)
          AND (${to ?? null}::date IS NULL OR w.viewed_on <= ${to ?? null}::date)
          AND (${pattern}::text IS NULL OR m.title ILIKE ${pattern} OR m.title_en ILIKE ${pattern}
            OR m.original_title ILIKE ${pattern} OR ${alias}::text = ANY(m.title_aliases))`;
        const order =
          query.sort === 'oldest' ? ('asc' as const) : ('desc' as const);
        const rows = await tx.watchEntry.findMany({
          where,
          include: diaryInclude(userId),
          orderBy: [{ viewedOn: order }, { createdAt: order }, { id: order }],
          take: query.limit,
          skip: query.offset,
        });
        return {
          items: rows.map((row) => this.entry(row)),
          total: stats.entries,
          stats,
          today: calendar.dateKey(new Date()),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  public async create(
    userId: string,
    input: CreateDiaryInput,
  ): Promise<DiarySaveResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      await lockResource(tx, `diary:request:${userId}:${input.requestId}`);
      const previous = await tx.watchEntry.findUnique({
        where: { userId_requestId: { userId, requestId: input.requestId } },
        include: diaryInclude(userId),
      });
      if (previous?.deletedAt)
        throw new ConflictException(
          'Запись уже удалена. Создайте новый просмотр.',
        );
      await lockResource(tx, `movie:${input.movieId}`);
      await lockResource(tx, `collection:${userId}:${input.movieId}`);
      await lockResource(tx, `diary:${userId}:${input.movieId}`);
      const calendar = await this.calendar(userId, tx);
      const movie = await tx.movie.findUnique({
        where: { id: input.movieId },
        select: { isSerial: true, seasonCount: true },
      });
      if (!movie) throw new NotFoundException('Произведение не найдено');
      const values = normalizeDiaryValues(input, movie, calendar.zone);
      if (input.syncStatus && values.scope === 'SEASON')
        throw new BadRequestException(
          'Просмотр сезона не завершает весь сериал',
        );
      if (input.syncRating && values.rating === null)
        throw new BadRequestException(
          'Укажите оценку для обновления коллекции',
        );
      const hash = createHash('sha256')
        .update(
          JSON.stringify({
            movieId: input.movieId,
            ...values,
            syncStatus: !!input.syncStatus,
            syncRating: !!input.syncRating,
          }),
        )
        .digest('hex');
      if (previous) {
        if (previous.requestHash !== hash)
          throw new ConflictException(
            'Этот запрос уже использован для другой записи',
          );
        return {
          status: 'saved' as const,
          entry: this.entry(previous),
          collectionUpdated: false,
        };
      }
      const member = await tx.userMovie.findUnique({
        where: { userId_movieId: { userId, movieId: input.movieId } },
        select: { id: true },
      });
      if (!member)
        throw new NotFoundException(
          'Сначала добавьте произведение в свою коллекцию',
        );
      const duplicate = await tx.watchEntry.findFirst({
        where: {
          userId,
          movieId: input.movieId,
          viewedOn: values.viewedOn,
          scope: values.scope,
          season: values.season,
          deletedAt: null,
        },
        include: diaryInclude(userId),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (duplicate && !input.allowDuplicate)
        return {
          status: 'duplicate' as const,
          entry: this.entry(duplicate),
          collectionUpdated: false,
        };
      const row = await tx.watchEntry.create({
        data: {
          userId,
          movieId: input.movieId,
          requestId: input.requestId,
          requestHash: hash,
          ...values,
        },
        include: diaryInclude(userId),
      });
      if (input.syncStatus || input.syncRating) {
        await this.collection.update(
          userId,
          input.movieId,
          {
            ...(input.syncRating ? { personalRate: values.rating! } : {}),
            ...(input.syncStatus
              ? {
                  watchStatus: WatchStatus.COMPLETED,
                }
              : {}),
          },
          tx,
        );
      }
      return {
        status: 'saved' as const,
        entry: this.entry(row),
        collectionUpdated: !!(input.syncStatus || input.syncRating),
      };
    });
    if (result.status === 'saved' && result.collectionUpdated)
      invalidateDataCache(this.prisma);
    return result;
  }

  public async update(
    userId: string,
    id: string,
    input: UpdateDiaryInput,
  ): Promise<DiarySaveResult> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.watchEntry.findFirst({
        where: { id, userId, deletedAt: null },
        include: diaryInclude(userId),
      });
      if (!current?.movie) throw new NotFoundException('Запись не найдена');
      await lockResource(tx, `movie:${current.movie.id}`);
      await lockResource(tx, `diary:${userId}:${current.movie.id}`);
      const latest = await tx.watchEntry.findFirst({
        where: { id, userId, deletedAt: null },
        include: diaryInclude(userId),
      });
      if (!latest?.movie) throw new NotFoundException('Запись не найдена');
      if (latest.revision !== input.revision)
        throw new ConflictException(
          'Запись изменилась в другой вкладке. Обновите дневник.',
        );
      const calendar = await this.calendar(userId, tx);
      const values = normalizeDiaryValues(input, latest.movie, calendar.zone);
      const sameIdentity =
        latest.viewedOn.getTime() === values.viewedOn.getTime() &&
        latest.scope === values.scope &&
        latest.season === values.season;
      if (!sameIdentity && !input.allowDuplicate) {
        const duplicate = await tx.watchEntry.findFirst({
          where: {
            userId,
            movieId: current.movie.id,
            id: { not: id },
            deletedAt: null,
            viewedOn: values.viewedOn,
            scope: values.scope,
            season: values.season,
          },
          include: diaryInclude(userId),
        });
        if (duplicate)
          return {
            status: 'duplicate',
            entry: this.entry(duplicate),
            collectionUpdated: false,
          };
      }
      const row = await tx.watchEntry.update({
        where: { id },
        data: { ...values, revision: { increment: 1 } },
        include: diaryInclude(userId),
      });
      return {
        status: 'saved',
        entry: this.entry(row),
        collectionUpdated: false,
      };
    });
  }

  public async remove(
    userId: string,
    id: string,
    revision: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.watchEntry.findFirst({ where: { id, userId } });
      if (!row) throw new NotFoundException('Запись не найдена');
      if (row.deletedAt) return;
      await lockResource(tx, `movie:${row.movieId}`);
      await lockResource(tx, `diary:${userId}:${row.movieId}`);
      const current = await tx.watchEntry.findFirst({ where: { id, userId } });
      if (!current || current.deletedAt) return;
      if (current.revision !== revision)
        throw new ConflictException(
          'Запись изменилась в другой вкладке. Обновите дневник.',
        );
      // Оставляем только ключ повтора, чтобы задержанный запрос не вернул удалённую историю.
      await tx.watchEntry.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          revision: { increment: 1 },
          movieId: null,
          requestHash: '',
          viewedOn: new Date('1970-01-01T00:00:00Z'),
          scope: 'TITLE',
          season: null,
          isRewatch: false,
          rating: null,
          note: '',
        },
      });
    });
  }
}
