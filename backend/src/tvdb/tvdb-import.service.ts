import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { CatalogUser } from '../common/utils/catalog-owner';
import MovieService from '../movie/movie.service';
import { UserMovieService } from '../user-movie/user-movie.service';
import { PrismaService } from '../prisma/prisma.service';
import { TvdbProvider } from './tvdb-provider';
import { TvdbImportDto } from './tvdb.dto';
import { CreateMovieRequest } from '../movie/dto/create-movie.dto';
import { WatchStatus } from '../generated/prisma/enums';
import { normalizeMovieTitle } from '../common/utils/normalize-movie-title';
import { invalidateDataCache } from '../common/utils/data-revision';
import { lockResource } from '../common/utils/transaction-lock';
import type { TvdbPreview, TvdbType } from './tvdb.types';
import {
  MIN_MEDIA_YEAR,
  maxMediaYear,
} from '../common/validation/media-numbers';

@Injectable()
export class TvdbImportService {
  constructor(
    private readonly provider: TvdbProvider,
    private readonly prisma: PrismaService,
    private readonly movies: MovieService,
    private readonly collection: UserMovieService,
  ) {}
  public async search(
    query: string,
    type: TvdbType | undefined,
    year: number | undefined,
    user: CatalogUser,
  ) {
    const candidates = await this.provider.search(query, type, year);
    if (!candidates.length) return [];
    const local = await this.prisma.movie.findMany({
      where: {
        OR: candidates.map((c) => ({ tvdbType: c.type, tvdbId: Number(c.id) })),
      },
      select: {
        id: true,
        tvdbType: true,
        tvdbId: true,
        userMovies: {
          where: { userId: user.id },
          select: { id: true },
          take: 1,
        },
      },
    });
    return candidates.map((c) => {
      const stored = local.find(
        (m) => m.tvdbType === c.type && String(m.tvdbId) === c.id,
      );
      return {
        ...c,
        localMovieId: stored?.id ?? null,
        inCollection: Boolean(stored?.userMovies.length),
      };
    });
  }
  public async preview(type: TvdbType, id: string, user: CatalogUser) {
    this.provider.assertAvailable();
    const preview = await this.provider.preview(type, id);
    const localMatches = await this.movies.titleCandidates(
      preview.title || preview.titleEn || preview.originalTitle,
    );
    const bound = await this.prisma.movie.findFirst({
      where: { tvdbType: type, tvdbId: Number(id) },
      select: { id: true },
    });
    const inCollection = bound
      ? Boolean(
          await this.prisma.userMovie.findUnique({
            where: { userId_movieId: { userId: user.id, movieId: bound.id } },
            select: { id: true },
          }),
        )
      : false;
    return {
      ...preview,
      localMatches,
      localMovieId: bound?.id ?? null,
      inCollection,
    };
  }
  private validateProgress(
    preview: Pick<TvdbPreview, 'isSerial' | 'seasonCount' | 'episodeCount'>,
    input: TvdbImportDto,
  ): void {
    const progress = input.collection;
    if (
      (progress?.watchStatus ?? WatchStatus.NOT_STARTED) ===
        WatchStatus.NOT_STARTED &&
      ((progress?.currentEpisode ?? 0) > 0 ||
        (progress?.currentSeason ?? 0) > 0)
    )
      throw new BadRequestException(
        'Выберите статус просмотра для указанного прогресса',
      );
    for (const [value, cap] of [
      [progress?.currentSeason, preview.seasonCount],
      [progress?.currentEpisode, preview.episodeCount],
    ] as const) {
      if (
        value !== undefined &&
        ((!preview.isSerial && value > 0) || (cap !== null && value > cap))
      )
        throw new BadRequestException('Недопустимый прогресс просмотра');
    }
  }
  public async importMovie(
    input: TvdbImportDto,
    user: CatalogUser,
  ): Promise<{ movieId: string; alreadyInCollection: boolean }> {
    this.provider.assertAvailable();
    const bound = await this.prisma.movie.findFirst({
      where: { tvdbType: input.type, tvdbId: Number(input.id) },
    });
    const existingId = input.existingMovieId ?? bound?.id;
    const preview = existingId
      ? null
      : await this.provider.preview(input.type, input.id);
    const dto = preview
      ? plainToInstance(CreateMovieRequest, {
          title: (input.title ?? preview.title).trim(),
          description: (input.description ?? preview.description).trim(),
          countryCodes: input.countryCodes ?? preview.countryCodes,
          genres: input.genres ?? preview.genres,
          contentKind: input.contentKind ?? preview.contentKind,
          distinctReason: input.distinctReason,
          isSerial: preview.isSerial,
          publishDate: preview.year
            ? `${preview.year}-01-01T00:00:00.000Z`
            : null,
          actorIds: [],
          imageUrl: preview.posterUrl ?? undefined,
          seasonCount: preview.seasonCount ?? undefined,
          episodeCount: preview.episodeCount ?? undefined,
        })
      : null;
    if (dto) {
      const errors = validateSync(dto);
      if (errors.length) {
        const field = errors.find((error) =>
          ['publishDate', 'seasonCount', 'episodeCount'].includes(
            error.property,
          ),
        )?.property;
        throw new BadRequestException(
          field === 'publishDate'
            ? `Год выхода должен быть от ${MIN_MEDIA_YEAR} до ${maxMediaYear()}`
            : field === 'seasonCount'
              ? 'Допустимо не более 100 сезонов'
              : field === 'episodeCount'
                ? 'Допустимо не более 5000 серий или выпусков'
                : 'Заполните название, описание, страну и хотя бы один жанр',
        );
      }
    }
    if (preview) this.validateProgress(preview, input);
    const result = await this.prisma.$transaction(
      async (tx) => {
        await lockResource(tx, 'catalog:identity');
        let movie = await tx.movie.findFirst({
          where: { tvdbType: input.type, tvdbId: Number(input.id) },
        });
        if (input.existingMovieId)
          movie = await tx.movie.findUnique({
            where: { id: input.existingMovieId },
          });
        if (!movie && existingId)
          throw new NotFoundException('Карточка не найдена');
        if (!movie) {
          if (!preview || !dto)
            throw new BadRequestException('Повторите проверку карточки');
          for (const actor of preview.actors.slice(0, input.actorLimit ?? 15)) {
            const stored = await tx.actor.upsert({
              where: { tvdbId: Number(actor.id) },
              update: {},
              create: {
                tvdbId: Number(actor.id),
                name: actor.name,
                createdById: user.role === 'ADMIN' ? null : user.id,
              },
            });
            dto.actorIds.push(stored.id);
          }
          movie = await this.movies.create(dto, user, tx);
          await tx.movie.update({
            where: { id: movie.id },
            data: {
              tvdbId: Number(input.id),
              tvdbType: input.type,
              titleEn: preview.titleEn,
              originalTitle: preview.originalTitle || null,
              titleAliases: [
                ...new Set(
                  [
                    preview.title,
                    preview.titleEn ?? '',
                    preview.originalTitle,
                    ...preview.aliases,
                  ]
                    .map(normalizeMovieTitle)
                    .filter(Boolean),
                ),
              ],
              descriptionLanguage:
                input.descriptionLanguage ?? preview.descriptionLanguage,
            },
          });
        }
        if (movie.isSerial !== (input.type === 'series'))
          throw new BadRequestException('Формат выбранной карточки отличается');
        await lockResource(tx, `movie:${movie.id}`);
        await lockResource(tx, `collection:${user.id}:${movie.id}`);
        const existing = await tx.userMovie.findUnique({
          where: { userId_movieId: { userId: user.id, movieId: movie.id } },
        });
        if (existing) return { movieId: movie.id, alreadyInCollection: true };
        this.validateProgress(movie, input);
        await this.collection.create(
          user.id,
          {
            movieId: movie.id,
            watchStatus: WatchStatus.NOT_STARTED,
            seeLater: true,
            ...input.collection,
          },
          tx,
        );
        return { movieId: movie.id, alreadyInCollection: false };
      },
      { timeout: 15000 },
    );
    invalidateDataCache(this.prisma);
    return result;
  }
}
