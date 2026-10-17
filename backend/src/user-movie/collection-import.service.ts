import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { normalizeMovieTitle } from '../common/utils/normalize-movie-title';
import { lockResource } from '../common/utils/transaction-lock';
import { invalidateDataCache } from '../common/utils/data-revision';
import { UserMovieService } from './user-movie.service';
import { parseCollectionFile, type CollectionEntry } from './collection-file';
import type {
  CheckCollectionImportDto,
  CommitCollectionImportDto,
  CollectionMatchDto,
} from './collection-import.dto';

type ImportUser = { id: string };
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const stale = () =>
  new ConflictException(
    'Проверка устарела или файл изменился. Нажмите «Проверить» ещё раз.',
  );

@Injectable()
export class CollectionImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movies: UserMovieService,
    private readonly jwt: JwtService,
  ) {}

  private async preview(
    userId: string,
    entries: CollectionEntry[],
    tx: Prisma.TransactionClient = this.prisma,
    matches: CollectionMatchDto[] = [],
  ) {
    if (
      new Set(matches.map((match) => match.row)).size !== matches.length ||
      matches.some((match) => match.row < 1 || match.row > entries.length)
    ) {
      throw new BadRequestException('Некорректное сопоставление строк импорта');
    }
    const catalog = await tx.movie.findMany({
      where: {
        titleNormalized: {
          in: entries.map((entry) => normalizeMovieTitle(entry.title)),
        },
      },
      select: {
        id: true,
        title: true,
        titleNormalized: true,
        isSerial: true,
        contentKind: true,
        publishDate: true,
        countryCodes: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
    });
    const existing = new Set(
      (
        await tx.userMovie.findMany({
          where: { userId, movieId: { in: catalog.map((movie) => movie.id) } },
          select: { movieId: true },
        })
      ).map((row) => row.movieId),
    );
    const seen = new Set<string>();
    const rows = entries.map((entry, index) => {
      const candidates = catalog.filter(
        (movie) =>
          movie.titleNormalized === normalizeMovieTitle(entry.title) &&
          movie.isSerial === entry.isSerial &&
          (entry.year === undefined ||
            (movie.publishDate?.getUTCFullYear() ?? null) === entry.year) &&
          (entry.contentKind === undefined ||
            movie.contentKind === entry.contentKind),
      );
      const selected = matches.find((match) => match.row === index + 1);
      const movie = selected
        ? candidates.find((candidate) => candidate.id === selected.movieId)
        : candidates.length === 1
          ? candidates[0]
          : undefined;
      let issue = '';
      if (selected && !movie)
        issue =
          'Выбранная карточка не соответствует строке файла. Проверьте сопоставление.';
      else if (candidates.length > 1 && !movie)
        issue = 'Найдено несколько произведений. Выберите нужную карточку.';
      else if (!movie)
        issue =
          'Тайтл с указанным форматом, годом и категорией не найден. Уточните данные или сначала добавьте его в каталог.';
      else if (seen.has(movie.id)) issue = 'Дубликат тайтла внутри файла';
      if (movie) seen.add(movie.id);
      return {
        row: index + 1,
        title: entry.title,
        movieId: movie?.id ?? null,
        watchStatus: entry.watchStatus,
        isFavorite: entry.isFavorite,
        seeLater: entry.seeLater,
        personalRate: entry.personalRate,
        status: issue ? 'error' : existing.has(movie!.id) ? 'exists' : 'ready',
        issue,
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          isSerial: candidate.isSerial,
          contentKind: candidate.contentKind,
          year: candidate.publishDate?.getUTCFullYear() ?? null,
          countryCodes: candidate.countryCodes,
        })),
      };
    });
    const fingerprint = digest(
      JSON.stringify(
        catalog.map((movie) => [movie.id, movie.updatedAt.toISOString()]),
      ),
    );
    return {
      rows,
      fingerprint,
      valid: rows.every((row) => row.status !== 'error'),
      ready: rows.filter((row) => row.status === 'ready').length,
      existing: rows.filter((row) => row.status === 'exists').length,
      errors: rows.filter((row) => row.status === 'error').length,
    };
  }

  public async check(user: ImportUser, dto: CheckCollectionImportDto) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { authVersion: true, blockedAt: true },
    });
    if (!account || account.blockedAt) throw new ForbiddenException();
    const preview = await this.preview(
      user.id,
      parseCollectionFile(dto.format, dto.content),
      this.prisma,
      dto.matches,
    );
    const { fingerprint, ...result } = preview;
    const proof = preview.valid
      ? await this.jwt.signAsync(
          {
            type: 'collection-import',
            userId: user.id,
            authVersion: account.authVersion,
            digest: digest(
              dto.format +
                '\n' +
                dto.content +
                '\n' +
                JSON.stringify(dto.matches ?? []),
            ),
            fingerprint,
          },
          { expiresIn: '10m', algorithm: 'HS256' },
        )
      : null;
    return { ...result, proof };
  }

  public async commit(user: ImportUser, dto: CommitCollectionImportDto) {
    const entries = parseCollectionFile(dto.format, dto.content);
    let proof: Record<string, unknown>;
    try {
      proof = await this.jwt.verifyAsync<Record<string, unknown>>(dto.proof, {
        algorithms: ['HS256'],
      });
    } catch {
      throw stale();
    }
    if (
      proof.type !== 'collection-import' ||
      proof.userId !== user.id ||
      proof.digest !==
        digest(
          dto.format +
            '\n' +
            dto.content +
            '\n' +
            JSON.stringify(dto.matches ?? []),
        ) ||
      typeof proof.fingerprint !== 'string'
    )
      throw stale();
    const result = await this.prisma.$transaction(
      async (tx) => {
        await lockResource(tx, 'catalog:identity');
        await lockResource(tx, `user:${user.id}`);
        const account = await tx.user.findUnique({
          where: { id: user.id },
          select: { authVersion: true, blockedAt: true },
        });
        if (
          !account ||
          account.blockedAt ||
          proof.authVersion !== account.authVersion
        )
          throw stale();
        const initial = await this.preview(user.id, entries, tx, dto.matches);
        const ids = [
          ...new Set(
            initial.rows.flatMap((row) => (row.movieId ? [row.movieId] : [])),
          ),
        ].sort();
        for (const id of ids) await lockResource(tx, `movie:${id}`);
        for (const id of ids)
          await lockResource(tx, `collection:${user.id}:${id}`);
        const current = await this.preview(user.id, entries, tx, dto.matches);
        if (!current.valid)
          throw new BadRequestException(
            'В файле есть ошибки. Проверьте его ещё раз.',
          );
        if (current.fingerprint !== proof.fingerprint) throw stale();
        let added = 0;
        for (const row of [...current.rows].sort((a, b) =>
          a.movieId!.localeCompare(b.movieId!),
        )) {
          if (row.status === 'exists') continue;
          const entry = entries[row.row - 1];
          if (entry.addedAt !== undefined) {
            await tx.userMovie.create({
              data: {
                userId: user.id,
                movieId: row.movieId!,
                watchStatus: entry.watchStatus,
                isFavorite: entry.isFavorite,
                seeLater: entry.seeLater,
                personalRate: entry.personalRate,
                currentSeason: entry.currentSeason,
                currentEpisode: entry.currentEpisode,
                addedAt: new Date(entry.addedAt),
                startedAt: entry.startedAt ? new Date(entry.startedAt) : null,
                completedAt: entry.completedAt
                  ? new Date(entry.completedAt)
                  : null,
                lastWatchedAt: entry.lastWatchedAt
                  ? new Date(entry.lastWatchedAt)
                  : null,
                droppedAt: entry.droppedAt ? new Date(entry.droppedAt) : null,
              },
            });
          } else {
            await this.movies.create(
              user.id,
              {
                movieId: row.movieId!,
                watchStatus: entry.watchStatus,
                isFavorite: entry.isFavorite,
                seeLater: entry.seeLater,
                personalRate: entry.personalRate ?? 0,
              },
              tx,
            );
          }
          added++;
        }
        return { added, skipped: current.existing };
      },
      { maxWait: 5000, timeout: 20000 },
    );
    if (result.added) invalidateDataCache(this.prisma);
    return result;
  }
}
