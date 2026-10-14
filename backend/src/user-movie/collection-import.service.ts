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
  ) {
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
        publishDate: true,
        updatedAt: true,
      },
    });
    const byTitle = new Map(
      catalog.map((movie) => [movie.titleNormalized, movie]),
    );
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
      const movie = byTitle.get(normalizeMovieTitle(entry.title));
      let issue = '';
      if (!movie) issue = 'Тайтл не найден. Сначала добавьте его в каталог.';
      else if (movie.isSerial !== entry.isSerial)
        issue = 'Тип отличается от каталога';
      else if (
        entry.year !== undefined &&
        movie.publishDate?.getUTCFullYear() !== entry.year
      )
        issue = 'Год отличается от каталога';
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
      };
    });
    const fingerprint = digest(
      JSON.stringify(
        entries.map((entry) => {
          const movie = byTitle.get(normalizeMovieTitle(entry.title));
          return movie ? [movie.id, movie.updatedAt.toISOString()] : null;
        }),
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
    );
    const { fingerprint, ...result } = preview;
    const proof = preview.valid
      ? await this.jwt.signAsync(
          {
            type: 'collection-import',
            userId: user.id,
            authVersion: account.authVersion,
            digest: digest(dto.format + '\n' + dto.content),
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
      proof.digest !== digest(dto.format + '\n' + dto.content) ||
      typeof proof.fingerprint !== 'string'
    )
      throw stale();
    const result = await this.prisma.$transaction(
      async (tx) => {
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
        const initial = await this.preview(user.id, entries, tx);
        const ids = [
          ...new Set(
            initial.rows.flatMap((row) => (row.movieId ? [row.movieId] : [])),
          ),
        ].sort();
        for (const id of ids) await lockResource(tx, `movie:${id}`);
        for (const id of ids)
          await lockResource(tx, `collection:${user.id}:${id}`);
        const current = await this.preview(user.id, entries, tx);
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
          await this.movies.create(
            user.id,
            {
              movieId: row.movieId!,
              watchStatus: entry.watchStatus,
              isFavorite: entry.isFavorite,
              seeLater: entry.seeLater,
              personalRate: entry.personalRate,
            },
            tx,
          );
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
