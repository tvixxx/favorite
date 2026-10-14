import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMovieRequest, PatchMovieDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertCatalogOwner,
  type CatalogUser,
} from '../common/utils/catalog-owner';
import type {
  Actor,
  Genre,
  Movie,
  Prisma,
  Review,
} from '../generated/prisma/client';
import { MoviesStatsResponse } from './dto/movies-stats.dto';
import { WatchStatus } from '../generated/prisma/enums';
import { normalizeMovieTitle } from '../common/utils';
import { UserMovieService } from '../user-movie/user-movie.service';
import { MediaService } from '../media/media.service';
import { queryInteger } from '../common/utils/query-value';
import { lockResource } from '../common/utils/transaction-lock';
import { invalidateDataCache } from '../common/utils/data-revision';

interface MovieFilters {
  genres?: Genre[];
  countryCodes?: string[];
  publishDateFrom?: string;
  publishDateTo?: string;
  actorIds?: string[];
}

export interface SimilarMovieDto {
  movieId: string;
  title: string;
  isSerial: boolean;
  publishDate: string | null;
  posterUrl: string | null;
}

export type MovieWithAverageRating = Movie & {
  averageRating: number | null;
};

@Injectable()
class MovieService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userMovieService: UserMovieService,
    private readonly media: MediaService,
  ) {}

  private async findDuplicateMovieIdByNormalizedTitle(
    title: string,
    excludeMovieId?: string,
  ): Promise<string | null> {
    const normalized = normalizeMovieTitle(title);

    if (!normalized.length) {
      return null;
    }

    const existing = await this.prismaService.movie.findFirst({
      where: {
        titleNormalized: normalized,
        ...(excludeMovieId ? { NOT: { id: excludeMovieId } } : {}),
      },
      select: { id: true },
    });

    return existing?.id ?? null;
  }

  private async withAverageRatings<M extends { id: string }>(
    movies: M[],
  ): Promise<Array<M & { averageRating: number | null }>> {
    if (!movies.length) {
      return [];
    }

    const ids = movies.map((m) => m.id);
    const grouped = await this.prismaService.review.groupBy({
      by: ['movieId'],
      where: { movieId: { in: ids }, hiddenAt: null },
      _avg: { rate: true },
    });
    const map = new Map(grouped.map((g) => [g.movieId, g._avg.rate]));

    return movies.map((m) => ({
      ...m,
      averageRating: map.get(m.id) ?? null,
    }));
  }

  public async findAll(
    filters: MovieFilters = {},
  ): Promise<MovieWithAverageRating[]> {
    const where = this.buildWhereClause(filters);

    const movies = await this.prismaService.movie.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        poster: {
          select: {
            url: true,
            thumbnailUrl: true,
            assetId: true,
          },
        },
        _count: {
          select: {
            reviews: { where: { hiddenAt: null } },
            actors: true,
          },
        },
      },
    });

    return this.withAverageRatings(movies);
  }

  public async findPage(
    filters: MovieFilters,
    query: string | undefined,
    limit: number,
    offset: number,
  ): Promise<{
    items: MovieWithAverageRating[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const where = this.buildWhereClause(filters, query?.trim() || undefined);
    const [movies, total] = await this.prismaService.$transaction(
      [
        this.prismaService.movie.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            poster: {
              select: { url: true, thumbnailUrl: true, assetId: true },
            },
            _count: {
              select: { reviews: { where: { hiddenAt: null } }, actors: true },
            },
          },
        }),
        this.prismaService.movie.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );

    return {
      items: await this.withAverageRatings(movies),
      total,
      limit,
      offset,
    };
  }

  public async create(
    dto: CreateMovieRequest,
    user: CatalogUser,
  ): Promise<MovieWithAverageRating> {
    const {
      actorIds,
      imageUrl,
      title,
      publishDate,
      description,
      countryCodes,
      genres,
      isSerial,
      seasonCount,
      episodeCount,
    } = dto;

    const duplicateOnCreate =
      await this.findDuplicateMovieIdByNormalizedTitle(title);

    if (duplicateOnCreate) {
      throw new ConflictException(
        'Фильм с таким названием уже есть в общем каталоге. Измените название или добавьте существующую позицию из каталога.',
      );
    }

    const created = await this.prismaService.$transaction(async (tx) => {
      const poster =
        imageUrl || dto.posterAssetId
          ? await this.media.select(
              tx,
              { assetId: dto.posterAssetId, url: imageUrl },
              user.id,
              'MOVIE_POSTER',
            )
          : null;
      const actors = await tx.actor.findMany({
        where: {
          id: {
            in: actorIds,
          },
        },
      });

      if (actors.length !== actorIds.length) {
        throw new NotFoundException('Один или несколько актеров не найдены');
      }

      const movie = await tx.movie.create({
        data: {
          createdBy:
            user.role === 'ADMIN' ? undefined : { connect: { id: user.id } },
          title,
          titleNormalized: normalizeMovieTitle(title),
          publishDate: publishDate ? new Date(publishDate) : publishDate,
          description,
          countryCodes,
          genres,
          isSerial,
          seasonCount,
          episodeCount,
          poster: poster?.url
            ? {
                create: {
                  url: poster.url,
                  thumbnailUrl: poster.thumbnailUrl,
                  assetId: poster.assetId,
                },
              }
            : undefined,
          actors: {
            connect: actors.map((actor) => ({
              id: actor.id,
            })),
          },
        },
        include: {
          poster: {
            select: {
              url: true,
              thumbnailUrl: true,
              assetId: true,
            },
          },
          _count: {
            select: {
              reviews: true,
              actors: true,
            },
          },
        },
      });

      if (dto.collection) {
        await this.userMovieService.create(
          user.id,
          { ...dto.collection, movieId: movie.id },
          tx,
        );
      }

      await this.auditCatalogChange(
        tx,
        user,
        movie.id,
        'MOVIE_CREATE',
        Object.keys(dto),
      );

      return movie;
    });

    invalidateDataCache(this.prismaService);
    return { ...created, averageRating: null };
  }

  public async findById(id: string): Promise<MovieWithAverageRating> {
    const movie = await this.prismaService.movie.findUnique({
      where: {
        id,
      },
      include: {
        actors: true,
        poster: true,
        // Инлайн отдаём только 10 свежих (превью показывает latest-10);
        // полный список — через пагинированный getReviewsByMovieId
        reviews: {
          where: { hiddenAt: null },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!movie) {
      throw new NotFoundException(`Фильм с айди: ${id} не найден`);
    }

    const avg = await this.prismaService.review.aggregate({
      where: { movieId: id, hiddenAt: null },
      _avg: { rate: true },
    });

    return {
      ...movie,
      averageRating: avg._avg.rate ?? null,
    };
  }

  public async getActorsByMovieId(
    id: string,
    take: string = '10',
  ): Promise<Actor[]> {
    const takeLimit = queryInteger(take, 'take', 10, 1, 100);

    return this.prismaService.actor.findMany({
      where: {
        movies: {
          some: { id },
        },
      },
      take: takeLimit,
      orderBy: {
        name: 'desc',
      },
    });
  }

  /**
   * «Похожее из вашей коллекции»: тайтлы пользователя того же жанра, которые он
   * ещё не просмотрел. Никаких рекомендаций «наугад» — только своя коллекция,
   * поэтому на маленькой базе выдача остаётся осмысленной.
   *
   * `scope` заложен на будущее: `global` (популярное у других, чего нет у меня)
   * подключается тем же эндпоинтом без правок фронта.
   */
  public async findSimilarFromCollection(
    movieId: string,
    userId: string,
    limit = 4,
  ): Promise<SimilarMovieDto[]> {
    const source = await this.prismaService.movie.findUnique({
      where: { id: movieId },
      select: { genres: true, isSerial: true },
    });

    if (!source) {
      return [];
    }

    const sourceGenresList = source.genres ?? [];

    // Жанры у тайтла могут быть не заполнены (или ни с чем не совпасть) —
    // тогда подбираем по типу: сериал к сериалу, фильм к фильму
    const genreWhere = sourceGenresList.length
      ? { movie: { genres: { hasSome: sourceGenresList } } }
      : { movie: { isSerial: source.isSerial } };

    // Берём запас и ранжируем по числу совпавших жанров уже в памяти:
    // Prisma не умеет сортировать по размеру пересечения массивов
    const candidates = await this.prismaService.userMovie.findMany({
      where: {
        userId,
        movieId: { not: movieId },
        watchStatus: { not: WatchStatus.COMPLETED },
        ...genreWhere,
      },
      select: {
        movieId: true,
        movie: {
          select: {
            title: true,
            genres: true,
            isSerial: true,
            publishDate: true,
            poster: { select: { url: true } },
          },
        },
      },
      take: 40,
      orderBy: { addedAt: 'desc' },
    });

    const sourceGenres = new Set(sourceGenresList);

    const ranked = candidates
      .map((row) => ({
        movieId: row.movieId,
        title: row.movie.title,
        isSerial: row.movie.isSerial,
        publishDate: row.movie.publishDate?.toISOString() ?? null,
        posterUrl: row.movie.poster?.url ?? null,
        matches: row.movie.genres.filter((genre) => sourceGenres.has(genre))
          .length,
      }))
      .sort((a, b) => b.matches - a.matches)
      .slice(0, limit)
      .map((row) => ({
        movieId: row.movieId,
        title: row.title,
        isSerial: row.isSerial,
        publishDate: row.publishDate,
        posterUrl: row.posterUrl,
      }));

    if (ranked.length || !sourceGenresList.length) {
      return ranked;
    }

    // Жанры есть, но пересечений не нашлось — показываем тайтлы того же типа
    return this.findSimilarByKind(movieId, userId, source.isSerial, limit);
  }

  private async findSimilarByKind(
    movieId: string,
    userId: string,
    isSerial: boolean,
    limit: number,
  ): Promise<SimilarMovieDto[]> {
    const rows = await this.prismaService.userMovie.findMany({
      where: {
        userId,
        movieId: { not: movieId },
        watchStatus: { not: WatchStatus.COMPLETED },
        movie: { isSerial },
      },
      select: {
        movieId: true,
        movie: {
          select: {
            title: true,
            isSerial: true,
            publishDate: true,
            poster: { select: { url: true } },
          },
        },
      },
      take: limit,
      orderBy: { addedAt: 'desc' },
    });

    return rows.map((row) => ({
      movieId: row.movieId,
      title: row.movie.title,
      isSerial: row.movie.isSerial,
      publishDate: row.movie.publishDate?.toISOString() ?? null,
      posterUrl: row.movie.poster?.url ?? null,
    }));
  }

  public async getReviewsByMovieId(
    id: string,
    take: string = '10',
  ): Promise<Review[]> {
    const takeLimit = queryInteger(take, 'take', 10, 1, 100);

    return this.prismaService.review.findMany({
      where: {
        hiddenAt: null,
        movie: {
          id,
        },
      },
      // Автор нужен списку отзывов на детальной («Аня · 2 часа назад»)
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      take: takeLimit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  public async update(
    id: string,
    dto: CreateMovieRequest,
    user: CatalogUser,
  ): Promise<boolean> {
    const {
      actorIds,
      title,
      publishDate,
      description,
      countryCodes,
      genres,
      isSerial,
      seasonCount,
      episodeCount,
    } = dto;

    const result = await this.prismaService.$transaction(async (tx) => {
      await lockResource(tx, `movie:${id}`);
      const movie = await tx.movie.findUnique({
        where: { id },
        include: { poster: true },
      });

      if (!movie) {
        throw new NotFoundException('Фильм не был найден!');
      }

      assertCatalogOwner(movie.createdById, user);

      await this.assertTypeChangeAllowed(tx, movie, isSerial);
      const posterChange = await this.posterChange(tx, movie, dto, user.id);

      const actors = await tx.actor.findMany({
        where: {
          id: {
            in: actorIds,
          },
        },
      });

      if (actors.length !== actorIds.length) {
        throw new NotFoundException('Один или несколько актеров не найдены');
      }

      const duplicateId = await this.findDuplicateMovieIdByNormalizedTitle(
        title,
        id,
      );

      if (duplicateId) {
        throw new ConflictException(
          'Фильм с таким названием уже есть в общем каталоге.',
        );
      }

      await tx.movie.update({
        where: { id },
        data: {
          title,
          titleNormalized: normalizeMovieTitle(title),
          publishDate: publishDate ? new Date(publishDate) : publishDate,
          description,
          countryCodes,
          genres,
          isSerial,
          seasonCount: isSerial ? seasonCount : null,
          episodeCount: isSerial ? episodeCount : null,
          poster: posterChange?.relation,
          actors: {
            set: actors.map((actor) => ({ id: actor.id })),
          },
        },
      });

      if (posterChange) {
        await this.finishPosterChange(tx, posterChange);
      }

      await this.auditCatalogChange(
        tx,
        user,
        id,
        'MOVIE_UPDATE',
        Object.keys(dto),
      );

      return true;
    });
    invalidateDataCache(this.prismaService);
    return result;
  }

  public async patch(
    id: string,
    dto: PatchMovieDto,
    user: CatalogUser,
  ): Promise<boolean> {
    const result = await this.prismaService.$transaction(async (tx) => {
      await lockResource(tx, `movie:${id}`);
      const movie = await tx.movie.findUnique({
        where: { id },
        include: { poster: true },
      });

      if (!movie) {
        throw new NotFoundException('Фильм не был найден!');
      }

      assertCatalogOwner(movie.createdById, user);

      const {
        actorIds,
        title,
        publishDate,
        description,
        countryCodes,
        genres,
        isSerial,
        seasonCount,
        episodeCount,
      } = dto;

      if (
        dto.expectedUpdatedAt &&
        movie.updatedAt.getTime() !== new Date(dto.expectedUpdatedAt).getTime()
      ) {
        throw new ConflictException(
          'Карточку уже изменили. Откройте её заново перед сохранением',
        );
      }

      const updateData: Prisma.MovieUpdateInput = {};

      await this.assertTypeChangeAllowed(tx, movie, isSerial);

      if (title !== undefined) {
        const duplicateId = await this.findDuplicateMovieIdByNormalizedTitle(
          title,
          id,
        );

        if (duplicateId) {
          throw new ConflictException(
            'Фильм с таким названием уже есть в общем каталоге.',
          );
        }

        updateData.title = title;
        updateData.titleNormalized = normalizeMovieTitle(title);
      }

      if (publishDate !== undefined) {
        updateData.publishDate = publishDate ? new Date(publishDate) : null;
      }

      if (description !== undefined) {
        updateData.description = description;
      }

      if (countryCodes !== undefined) {
        updateData.countryCodes = { set: countryCodes };
      }

      if (genres !== undefined) {
        updateData.genres = { set: genres };
      }

      if (isSerial !== undefined) {
        updateData.isSerial = isSerial;
      }

      if (seasonCount !== undefined) {
        updateData.seasonCount = seasonCount;
      }

      if (episodeCount !== undefined) {
        updateData.episodeCount = episodeCount;
      }

      if (isSerial === false) {
        updateData.seasonCount = null;
        updateData.episodeCount = null;
      }

      if (actorIds !== undefined) {
        const actors = await tx.actor.findMany({
          where: { id: { in: actorIds } },
        });

        if (actors.length !== actorIds.length) {
          throw new NotFoundException('Один или несколько актеров не найдены');
        }

        updateData.actors = {
          set: actors.map((actor) => ({ id: actor.id })),
        };
      }

      const posterChange = await this.posterChange(tx, movie, dto, user.id);

      if (posterChange) {
        updateData.poster = posterChange.relation;
      }

      await tx.movie.update({ where: { id }, data: updateData });
      if (posterChange) {
        await this.finishPosterChange(tx, posterChange);
      }

      await this.auditCatalogChange(
        tx,
        user,
        id,
        'MOVIE_UPDATE',
        Object.keys(dto),
      );

      return true;
    });
    invalidateDataCache(this.prismaService);
    return result;
  }

  private async assertTypeChangeAllowed(
    tx: Prisma.TransactionClient,
    movie: Movie,
    isSerial: boolean | undefined,
  ): Promise<void> {
    if (!movie.isSerial || isSerial !== false) {
      return;
    }

    const progress = await tx.userMovie.findFirst({
      where: {
        movieId: movie.id,
        OR: [{ currentSeason: { gt: 0 } }, { currentEpisode: { gt: 0 } }],
      },
      select: { id: true },
    });

    if (progress) {
      throw new ConflictException(
        'Нельзя изменить сериал на фильм: у пользователей есть прогресс по сезонам или эпизодам.',
      );
    }
  }

  private async auditCatalogChange(
    tx: Prisma.TransactionClient,
    user: CatalogUser,
    targetId: string,
    action: string,
    fields: string[] = [],
  ): Promise<void> {
    if (user.role !== 'ADMIN') {
      return;
    }

    await tx.adminAuditLog.create({
      data: {
        actorId: user.id,
        targetId,
        action,
        reason: fields.length
          ? `Поля: ${fields.join(', ')}`
          : 'Удаление тайтла',
      },
    });
  }

  private async posterChange(
    tx: Prisma.TransactionClient,
    movie: Movie & { poster?: { assetId: string | null } | null },
    dto: Partial<CreateMovieRequest>,
    ownerId: string,
  ): Promise<{
    relation: Prisma.MoviePosterUpdateOneWithoutMovieNestedInput;
    obsoleteAssetId?: string | null;
    removedPosterId?: string | null;
  } | null> {
    if (dto.imageUrl === undefined && dto.posterAssetId === undefined) {
      return null;
    }

    const selected = await this.media.select(
      tx,
      { assetId: dto.posterAssetId, url: dto.imageUrl },
      ownerId,
      'MOVIE_POSTER',
      movie.poster?.assetId,
    );
    const data = {
      url: selected.url ?? '',
      thumbnailUrl: selected.thumbnailUrl,
      assetId: selected.assetId,
    };

    return {
      relation: selected.url
        ? { upsert: { create: data, update: data } }
        : { disconnect: true },
      obsoleteAssetId:
        movie.poster?.assetId !== selected.assetId
          ? movie.poster?.assetId
          : null,
      removedPosterId: selected.url ? null : movie.posterId,
    };
  }

  private async finishPosterChange(
    tx: Prisma.TransactionClient,
    change: {
      obsoleteAssetId?: string | null;
      removedPosterId?: string | null;
    },
  ): Promise<void> {
    if (change.removedPosterId) {
      await tx.moviePoster.deleteMany({
        where: { id: change.removedPosterId },
      });
    }

    await this.media.release(tx, change.obsoleteAssetId);
  }

  public async delete(id: string, user: CatalogUser): Promise<string> {
    try {
      await this.prismaService.$transaction(async (tx) => {
        await lockResource(tx, `movie:${id}`);
        const movie = await tx.movie.findUnique({
          where: { id },
          include: { poster: true },
        });

        if (!movie) {
          throw new NotFoundException(`Фильм с айди: ${id} не найден`);
        }

        assertCatalogOwner(movie.createdById, user);
        await tx.movie.delete({ where: { id } });
        if (movie.posterId) {
          await tx.moviePoster.deleteMany({ where: { id: movie.posterId } });
        }

        await this.media.release(tx, movie.poster?.assetId);
        await this.auditCatalogChange(tx, user, id, 'MOVIE_DELETE');
      });

      invalidateDataCache(this.prismaService);
      return id;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Фильм с айди: ${id} не найден`);
      }

      throw error;
    }
  }

  public async getMoviesStats(): Promise<MoviesStatsResponse> {
    const [allMovies, allSerials] = await Promise.all([
      this.prismaService.movie.count(),
      this.prismaService.movie.count({ where: { isSerial: true } }),
    ]);

    // Общая статистика по всем пользователям
    const [allFavorites, allSeeLater] = await Promise.all([
      this.prismaService.userMovie.count({ where: { isFavorite: true } }),
      this.prismaService.userMovie.count({ where: { seeLater: true } }),
    ]);

    return {
      allMovies,
      allFavorites,
      allSerials,
      allSeeLater,
    };
  }

  public async suggestions(userId: string, query = '', limit = 10) {
    const q = query.trim();
    if (q.length > 200) throw new BadRequestException('Максимум 200 символов');
    if (q.length < 2) return [];
    const movies = await this.prismaService.movie.findMany({
      where: { title: { contains: q, mode: 'insensitive' } },
      take: limit,
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        isSerial: true,
        publishDate: true,
        userMovies: { where: { userId }, take: 1, select: { id: true } },
      },
    });
    return movies.map(({ userMovies, ...movie }) => ({
      ...movie,
      inCollection: userMovies.length > 0,
    }));
  }

  public async search(
    query?: string,
    filters: MovieFilters = {},
  ): Promise<MovieWithAverageRating[]> {
    const hasQuery = !!query?.trim();
    const hasFilters = this.filtersNonEmpty(filters);

    if (!hasQuery && !hasFilters) {
      return this.findAll();
    }

    const where = this.buildWhereClause(
      filters,
      hasQuery && query ? query.trim() : undefined,
    );

    const movies = await this.prismaService.movie.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        actors: true,
        poster: true,
        _count: {
          select: {
            reviews: { where: { hiddenAt: null } },
            actors: true,
          },
        },
      },
    });

    return this.withAverageRatings(movies);
  }

  private filtersNonEmpty(filters: MovieFilters): boolean {
    return !!(
      filters.genres?.length ||
      filters.countryCodes?.length ||
      filters.publishDateFrom ||
      filters.publishDateTo ||
      filters.actorIds?.length
    );
  }

  private buildWhereClause(
    filters: MovieFilters,
    query?: string,
  ): Prisma.MovieWhereInput {
    const and: Prisma.MovieWhereInput[] = [];

    if (query) {
      and.push({
        title: {
          contains: query,
          mode: 'insensitive',
        },
      });
    }

    if (filters.genres?.length) {
      and.push({
        genres: { hasSome: filters.genres },
      });
    }

    if (filters.countryCodes?.length) {
      and.push({
        countryCodes: { hasSome: filters.countryCodes },
      });
    }

    if (filters.publishDateFrom || filters.publishDateTo) {
      const publishDate: Prisma.DateTimeNullableFilter = {};

      if (filters.publishDateFrom) {
        publishDate.gte = new Date(filters.publishDateFrom);
      }

      if (filters.publishDateTo) {
        publishDate.lte = new Date(filters.publishDateTo);
      }

      and.push({ publishDate });
    }

    if (filters.actorIds?.length) {
      and.push({
        actors: { some: { id: { in: filters.actorIds } } },
      });
    }

    if (!and.length) {
      return {};
    }

    return and.length === 1 ? and[0] : { AND: and };
  }
}

export default MovieService;
