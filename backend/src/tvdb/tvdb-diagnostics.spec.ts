import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TvdbProvider } from './tvdb-provider';

const secret = 'private-fixture-key-and-response';
const envelope = (data: unknown) =>
  new Response(JSON.stringify({ status: 'success', data }));

describe('Безопасная диагностика TheTVDB', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['extended', new DOMException(secret, 'TimeoutError'), 'timeout'],
    [
      'translations/rus',
      new TypeError(secret, {
        cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', message: secret },
      }),
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    ],
    ['translations/eng', null, 'invalid_json'],
  ])(
    'показывает этап %s и причину без ключа или тела ответа',
    async (stage, failure, reason) => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.endsWith('/login'))
          return Promise.resolve(envelope({ token: secret }));
        if (url.endsWith(`/series/377543/${stage}`)) {
          return failure
            ? Promise.reject(failure)
            : Promise.resolve(new Response(secret));
        }
        return Promise.resolve(
          envelope({ id: 377543, name: 'Название', overview: 'Описание' }),
        );
      });
      const provider = new TvdbProvider(
        new ConfigService({
          CATALOG_TVDB_ENABLED: 'true',
          TVDB_API_KEY: secret,
        }),
      );
      const result = provider.preview('series', '377543');
      await expect(result).rejects.toMatchObject({
        status: 502,
        message: 'Не удалось получить данные TheTVDB',
      });
      expect(warn).toHaveBeenCalledWith(
        `TheTVDB request failed endpoint=series/377543/${stage} reason=${reason}`,
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
    },
  );

  it('не записывает поисковый запрос и произвольный код внешней ошибки', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      return url.endsWith('/login')
        ? Promise.resolve(envelope({ token: secret }))
        : Promise.reject(new TypeError(secret, { cause: { code: secret } }));
    });
    const provider = new TvdbProvider(
      new ConfigService({ CATALOG_TVDB_ENABLED: 'true', TVDB_API_KEY: secret }),
    );
    await expect(provider.search(secret)).rejects.toMatchObject({
      status: 502,
    });
    expect(warn).toHaveBeenCalledWith(
      'TheTVDB request failed endpoint=search reason=transport_or_body',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
  });
});
