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

    const promise = producer()
      .then((value) => {
        this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });

        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);

    return promise;
  }

  /** Сбросить кэш (напр. при мутации данных, если понадобится инвалидция). */
  public clear(): void {
    this.store.clear();
  }
}
