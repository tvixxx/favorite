import { HttpException } from '@nestjs/common';

/**
 * Простой in-memory TTL-кэш с коалесингом одновременных промахов.
 *
 * Назначение — дорогие, редко меняющиеся вычисления (напр. лидерборд):
 *  - значение живёт `ttlMs`, после чего пересчитывается по требованию;
 *  - параллельные запросы на «холодном» ключе НЕ запускают вычисление N раз —
 *    все ждут один общий Promise (это и снимает «стампед» при нескольких зрителях).
 *
 * Без внешних зависимостей и без Redis — по масштабу приложения этого достаточно.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<T>>();
  private generation = 0;

  constructor(private readonly ttlMs: number) {}

  public async wrap(key: string, producer: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);

    if (hit && Date.now() <= hit.expiresAt) {
      return hit.value;
    }

    const pending = this.inflight.get(key);

    if (pending) {
      return pending;
    }

    if (this.inflight.size >= 256) {
      throw new HttpException(
        'Слишком много одновременных вычислений. Повторите запрос позже.',
        429,
      );
    }

    const generation = this.generation;
    const promise = Promise.resolve()
      .then(producer)
      .then((value) => {
        if (generation === this.generation) {
          const now = Date.now();

          for (const [storedKey, entry] of this.store) {
            if (entry.expiresAt <= now) {
              this.store.delete(storedKey);
            }
          }

          this.store.delete(key);

          if (this.store.size >= 256) {
            const oldest: unknown = this.store.keys().next().value;

            if (typeof oldest === 'string') {
              this.store.delete(oldest);
            }
          }

          this.store.set(key, { value, expiresAt: now + this.ttlMs });
        }

        return value;
      })
      .finally(() => {
        if (this.inflight.get(key) === promise) {
          this.inflight.delete(key);
        }
      });

    this.inflight.set(key, promise);

    return promise;
  }

  /** Сбросить кэш (напр. при мутации данных, если понадобится инвалидция). */
  public clear(): void {
    this.generation++;
    this.store.clear();
    this.inflight.clear();
  }
}
