import { ConfigService } from '@nestjs/config';
import { TvdbProvider } from './tvdb-provider';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ status: 'success', data }), {
    headers: { 'content-type': 'application/json' },
  });
const configuration = (values: Record<string, string> = {}) =>
  new ConfigService(values);
function mockFetch(respond: (url: string) => Response) {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input) =>
      Promise.resolve(
        respond(
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        ),
      ),
    );
}

describe('Источник TheTVDB', () => {
  afterEach(() => jest.restoreAllMocks());

  it('без включённого флага отклоняет запрос без ключа и соединения с источником', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    const provider = new TvdbProvider(configuration());
    await expect(provider.search('Дюна', 'movie')).rejects.toMatchObject({
      status: 503,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, ''])(
    'при настроенном ключе включает поиск без отдельного флага %s',
    async (flag) => {
      mockFetch((url) =>
        url.endsWith('/login')
          ? envelope({ token: 'test-token' })
          : envelope([
              {
                tvdb_id: '6187',
                type: 'movie',
                name: 'Dune',
                translations: { rus: 'Дюна' },
              },
            ]),
      );
      const provider = new TvdbProvider(
        configuration({
          TVDB_API_KEY: 'test-key',
          ...(flag === undefined ? {} : { CATALOG_TVDB_ENABLED: flag }),
        }),
      );
      expect(await provider.search('Дюна', 'movie')).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: '6187' })]),
      );
    },
  );

  it('явный запрет сохраняет выключенный поиск даже при наличии ключа', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    const provider = new TvdbProvider(
      configuration({
        TVDB_API_KEY: 'test-key',
        CATALOG_TVDB_ENABLED: 'false',
      }),
    );
    await expect(provider.search('Дюна', 'movie')).rejects.toMatchObject({
      status: 503,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('не принимает ошибочный флаг и включение без ключа', () => {
    expect(
      () => new TvdbProvider(configuration({ CATALOG_TVDB_ENABLED: 'yes' })),
    ).toThrow();
    expect(
      () => new TvdbProvider(configuration({ CATALOG_TVDB_ENABLED: 'true' })),
    ).toThrow();
  });

  it('находит точный русский или альтернативный заголовок за пределами первой пятёрки', async () => {
    mockFetch((url) => {
      if (url.endsWith('/login')) return envelope({ token: 'test-token' });
      const offset = new URL(url).searchParams.get('offset');
      return envelope(
        offset === '25'
          ? [
              {
                tvdb_id: '6187',
                type: 'movie',
                name: 'Dune: Part One',
                year: '2021',
                translations: { rus: 'Дюна', eng: 'Dune: Part One' },
                aliases: ['Dune'],
              },
            ]
          : Array.from({ length: 25 }, (_, i) => ({
              tvdb_id: String(i + 100),
              type: 'movie',
              name: 'Other ' + i,
            })),
      );
    });
    const result = await new TvdbProvider(
      configuration({ CATALOG_TVDB_ENABLED: 'true', TVDB_API_KEY: 'test-key' }),
    ).search('Dune', 'movie');
    expect(result[0]).toMatchObject({
      id: '6187',
      title: 'Дюна',
      titleEn: 'Dune: Part One',
      year: 2021,
    });
  });

  it('повторяет пустой поиск без года и сохраняет найденную карточку', async () => {
    mockFetch((url) => {
      if (url.endsWith('/login')) return envelope({ token: 'test-token' });
      return envelope(
        new URL(url).searchParams.has('year')
          ? []
          : [
              {
                tvdb_id: '134695',
                type: 'movie',
                year: '1980',
                translations: { rus: 'Москва слезам не верит' },
              },
            ],
      );
    });
    const result = await new TvdbProvider(
      configuration({ CATALOG_TVDB_ENABLED: 'true', TVDB_API_KEY: 'test-key' }),
    ).search('Москва слезам не верит', 'movie', 1979);
    expect(result).toEqual([
      expect.objectContaining({ id: '134695', year: 1980 }),
    ]);
  });

  it('не следует перенаправлению с ключом и не раскрывает ошибку источника', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('test-key secret detail', {
        status: 302,
        headers: { location: 'https://example.test/' },
      }),
    );
    const provider = new TvdbProvider(
      configuration({ CATALOG_TVDB_ENABLED: 'true', TVDB_API_KEY: 'test-key' }),
    );
    const result = provider.search('Дюна', 'movie');
    await expect(result).rejects.toMatchObject({ status: 502 });
    await expect(result).rejects.not.toThrow('test-key');
  });

  it('оставляет количество серий неизвестным при ошибке следующей страницы', async () => {
    mockFetch((url) => {
      if (url.endsWith('/login')) return envelope({ token: 'test-token' });
      if (url.includes('page=1')) return new Response('', { status: 503 });
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            episodes: [
              { id: 1, seasonNumber: 1, number: 1, aired: '2020-01-01' },
            ],
          },
          links: { next: '?page=1' },
        }),
      );
    });
    const provider = new TvdbProvider(
      configuration({ CATALOG_TVDB_ENABLED: 'true', TVDB_API_KEY: 'test-key' }),
    );
    expect(await provider.countEpisodes('81797')).toEqual({
      seasonCount: null,
      episodeCount: null,
    });
  });

  it('считает только вышедшие обычные серии без повторов по всем страницам', async () => {
    mockFetch((url) => {
      if (url.endsWith('/login')) return envelope({ token: 'test-token' });
      const regular = {
        id: 2,
        seasonNumber: 1,
        number: 1,
        aired: '2020-01-01',
      };
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            episodes: url.includes('page=1')
              ? [regular, { ...regular, id: 3, seasonNumber: 2 }]
              : [
                  { ...regular, id: 1, seasonNumber: 0 },
                  regular,
                  { ...regular, id: 4, aired: '2099-01-01' },
                ],
          },
          links: { next: url.includes('page=1') ? null : '?page=1' },
        }),
      );
    });
    const provider = new TvdbProvider(
      configuration({ CATALOG_TVDB_ENABLED: 'true', TVDB_API_KEY: 'test-key' }),
    );
    expect(await provider.countEpisodes('81797')).toEqual({
      seasonCount: 2,
      episodeCount: 2,
    });
  });
  it('не принимает несуществующую календарную дату за вышедшую серию', async () => {
    mockFetch((url) =>
      url.endsWith('/login')
        ? envelope({ token: 'test-token' })
        : envelope({
            episodes: [
              { id: 1, seasonNumber: 1, number: 1, aired: '2024-02-30' },
            ],
          }),
    );
    const provider = new TvdbProvider(
      configuration({ CATALOG_TVDB_ENABLED: 'true', TVDB_API_KEY: 'test-key' }),
    );
    expect(await provider.countEpisodes('81797')).toEqual({
      seasonCount: null,
      episodeCount: null,
    });
  });
});
