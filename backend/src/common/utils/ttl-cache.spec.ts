import { TtlCache } from './ttl-cache';

describe('Ограниченный кеш вычислений', () => {
  it('ограничивает число разных незавершённых вычислений', async () => {
    const cache = new TtlCache<number>(60000);
    let complete!: (value: number) => void;
    const computation = new Promise<number>((resolve) => {
      complete = resolve;
    });
    const requests = Array.from({ length: 256 }, (_, index) =>
      cache.wrap(String(index), () => computation),
    );

    await expect(
      cache.wrap('overflow', () => computation),
    ).rejects.toMatchObject({ status: 429 });
    complete(1);
    expect((await Promise.all(requests)).length).toBe(256);
  });
  it('объединяет параллельные запросы и повторяет вычисление после TTL', async () => {
    jest.useFakeTimers();
    const cache = new TtlCache<number>(100);
    const producer = jest.fn().mockResolvedValue(7);

    try {
      expect(
        await Promise.all([
          cache.wrap('a', producer),
          cache.wrap('a', producer),
        ]),
      ).toEqual([7, 7]);
      expect(producer).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(101);
      await cache.wrap('a', producer);
      expect(producer).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('вытесняет старые ключи вместо бесконечного роста', async () => {
    const cache = new TtlCache<number>(60000);
    const producer = jest.fn().mockResolvedValue(7);

    for (let index = 0; index < 257; index++) {
      await cache.wrap(String(index), producer);
    }

    await cache.wrap('0', producer);
    expect(producer).toHaveBeenCalledTimes(258);
  });

  it('не восстанавливает старое значение после очистки незавершённого запроса', async () => {
    const cache = new TtlCache<number>(60000);
    let resolveOld!: (value: number) => void;
    const old = cache.wrap(
      'a',
      () =>
        new Promise<number>((resolve) => {
          resolveOld = resolve;
        }),
    );

    await Promise.resolve();
    cache.clear();
    const fresh = cache.wrap('a', () => Promise.resolve(2));
    resolveOld(1);
    expect(await old).toBe(1);
    expect(await fresh).toBe(2);
    expect(await cache.wrap('a', () => Promise.resolve(3))).toBe(2);
  });
});
