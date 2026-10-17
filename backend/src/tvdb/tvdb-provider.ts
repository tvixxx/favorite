import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtlCache } from '../common/utils/ttl-cache';
import { normalizeMovieTitle } from '../common/utils/normalize-movie-title';
import {
  mapTvdbCandidate,
  mapTvdbPreview,
  tvdbList,
  tvdbObject,
  tvdbText,
  tvdbIdText,
} from './tvdb-mapping';
import type { TvdbCandidate, TvdbPreview, TvdbType } from './tvdb.types';

@Injectable()
export class TvdbProvider {
  private readonly logger = new Logger(TvdbProvider.name);
  private readonly enabled: boolean;
  private readonly key: string;
  private readonly tokens = new TtlCache<string>(20 * 60 * 60 * 1000);
  private readonly responses = new TtlCache<unknown>(5 * 60 * 1000);
  private readonly previews = new TtlCache<TvdbPreview>(5 * 60 * 1000);

  constructor(config: ConfigService) {
    const flag = config.get<string>('CATALOG_TVDB_ENABLED') ?? 'false';
    if (!['true', 'false'].includes(flag))
      throw new Error('CATALOG_TVDB_ENABLED должен быть true или false');
    this.enabled = flag === 'true';
    this.key = this.enabled
      ? (config.get<string>('TVDB_API_KEY') ?? '').trim()
      : '';
    if (this.enabled && !this.key)
      throw new Error('Настройте TVDB_API_KEY для TheTVDB');
  }
  public isAvailable(): boolean {
    return this.enabled;
  }
  public assertAvailable(): void {
    if (!this.enabled)
      throw new ServiceUnavailableException('Внешний каталог выключен');
  }
  private failureReason(error: unknown): string {
    const details = error && typeof error === 'object' ? error : null;
    const name = details && 'name' in details ? details.name : undefined;
    if (name === 'SyntaxError') return 'invalid_json';
    if (name === 'TimeoutError') return 'timeout';
    if (name === 'AbortError') return 'aborted';
    const cause = details && 'cause' in details ? details.cause : undefined;
    const code =
      cause && typeof cause === 'object' && 'code' in cause
        ? cause.code
        : undefined;
    const allowed = [
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'CERT_HAS_EXPIRED',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'ERR_TLS_CERT_ALTNAME_INVALID',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
      'UND_ERR_SOCKET',
    ];
    return typeof code === 'string' && allowed.includes(code)
      ? code
      : 'transport_or_body';
  }
  private async request(
    path: string,
    payload?: object,
  ): Promise<Record<string, unknown>> {
    this.assertAvailable();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'FavouriteApp/1.0',
    };
    if (!payload)
      headers.Authorization = `Bearer ${await this.tokens.wrap(
        'token',
        async () => {
          const response = await this.request('login', { apikey: this.key });
          const token = tvdbText(tvdbObject(response.data).token);
          if (!token)
            throw new BadGatewayException('Не удалось подключиться к TheTVDB');
          return token;
        },
      )}`;
    try {
      const response = await fetch(`https://api4.thetvdb.com/v4/${path}`, {
        method: payload ? 'POST' : 'GET',
        headers,
        body: payload ? JSON.stringify(payload) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 404)
        throw new NotFoundException('Карточка или перевод TheTVDB не найдены');
      if (response.status === 401 || response.status === 403) {
        this.tokens.clear();
        throw new ServiceUnavailableException('TheTVDB временно недоступен');
      }
      if (response.status === 429)
        throw new ServiceUnavailableException(
          'TheTVDB ограничил запросы. Попробуйте позже',
        );
      if (!response.ok)
        throw new BadGatewayException('TheTVDB временно недоступен');
      const reader = response.body?.getReader();
      if (!reader) throw new BadGatewayException('Пустой ответ TheTVDB');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 6_000_000) {
            await reader.cancel();
            throw new BadGatewayException('Слишком большой ответ TheTVDB');
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const result = tvdbObject(
        JSON.parse(Buffer.concat(chunks).toString('utf8')),
      );
      if (result.status !== 'success' || !('data' in result))
        throw new BadGatewayException('Некорректный ответ TheTVDB');
      return result;
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      this.logger.warn(
        `TheTVDB request failed endpoint=${path.split('?')[0]} reason=${this.failureReason(error)}`,
      );
      throw new BadGatewayException('Не удалось получить данные TheTVDB');
    }
  }
  private async data(path: string): Promise<unknown> {
    return this.responses.wrap(
      path,
      async () => (await this.request(path)).data,
    );
  }
  public async search(
    query: string,
    type?: TvdbType,
    year?: number,
  ): Promise<TvdbCandidate[]> {
    this.assertAvailable();
    const items = new Map<string, TvdbCandidate>();
    for (const offset of [0, 25]) {
      const params = new URLSearchParams({
        query,
        limit: '25',
        offset: String(offset),
      });
      if (type) params.set('type', type);
      if (year) params.set('year', String(year));
      const rows = tvdbList(await this.data(`search?${params}`));
      if (rows.length > 25)
        throw new BadGatewayException('Некорректная страница поиска TheTVDB');
      for (const row of rows) {
        const candidate = mapTvdbCandidate(row);
        if (candidate && (!type || candidate.type === type))
          items.set(`${candidate.type}:${candidate.id}`, candidate);
      }
      if (rows.length < 25) break;
    }
    if (!items.size && year) return this.search(query, type);
    const needle = normalizeMovieTitle(query);
    const match = (item: TvdbCandidate): number => {
      const names = [
        item.title,
        item.titleEn ?? '',
        item.originalTitle,
        ...item.aliases,
      ]
        .map(normalizeMovieTitle)
        .filter(Boolean);
      return names.includes(needle)
        ? 2
        : names.some((name) => name.startsWith(needle))
          ? 1
          : 0;
    };
    return [...items.values()].sort(
      (a, b) =>
        match(b) - match(a) ||
        Number(b.year === year) - Number(a.year === year),
    );
  }
  public async preview(type: TvdbType, id: string): Promise<TvdbPreview> {
    this.assertAvailable();
    return this.previews.wrap(`${type}:${id}`, async () => {
      const base = `${type === 'movie' ? 'movies' : 'series'}/${id}`;
      const record = await this.data(`${base}/extended`);
      const translation = async (language: string): Promise<unknown> => {
        try {
          return await this.data(`${base}/translations/${language}`);
        } catch (error) {
          if (error instanceof NotFoundException) return null;
          throw error;
        }
      };
      const ru = await translation('rus');
      const en = await translation('eng');
      const result = mapTvdbPreview(type, id, record, ru, en);
      if (type === 'series')
        Object.assign(result, await this.countEpisodes(id));
      return result;
    });
  }
  public async countEpisodes(
    id: string,
  ): Promise<{ seasonCount: number | null; episodeCount: number | null }> {
    this.assertAvailable();
    const unknownCounts = { seasonCount: null, episodeCount: null };
    const seen = new Set<string>();
    const regular = new Set<string>();
    const seasons = new Set<number>();
    const started = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    try {
      for (let page = 0; page < 40; page++) {
        if (Date.now() - started > 20000) return unknownCounts;
        const response = await this.request(
          `series/${id}/episodes/default?page=${page}`,
        );
        const data = tvdbObject(response.data);
        const rows = tvdbList(data.episodes);
        let added = 0;
        for (const row of rows) {
          const episodeId = tvdbIdText(row.id);
          if (!/^[1-9]\d{0,9}$/.test(episodeId)) return unknownCounts;
          if (seen.has(episodeId)) continue;
          seen.add(episodeId);
          added++;
          const aired = tvdbText(row.aired);
          if (row.seriesId !== undefined && tvdbIdText(row.seriesId) !== id)
            return unknownCounts;
          if (
            typeof row.seasonNumber === 'number' &&
            row.seasonNumber > 0 &&
            Number.isInteger(row.seasonNumber) &&
            typeof row.number === 'number' &&
            row.number > 0 &&
            Number.isInteger(row.number) &&
            /^\d{4}-\d{2}-\d{2}$/.test(aired) &&
            !Number.isNaN(Date.parse(aired)) &&
            new Date(aired).toISOString().slice(0, 10) === aired &&
            aired <= today &&
            !row.isMovie
          ) {
            regular.add(episodeId);
            seasons.add(row.seasonNumber);
          }
        }
        if (
          regular.size > 10000 ||
          seen.size > 20000 ||
          [...seasons].some((s) => s > 1000)
        )
          return unknownCounts;
        const next = response.links ? tvdbObject(response.links).next : null;
        if (!next)
          return regular.size
            ? { seasonCount: Math.max(...seasons), episodeCount: regular.size }
            : unknownCounts;
        if (!added) return unknownCounts;
      }
    } catch {
      return unknownCounts;
    }
    return unknownCounts;
  }
}
