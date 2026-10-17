// shortcut: один backend, внешние записи покрывает TTL. Для нескольких API нужна общая инвалидизация.
const revisions = new WeakMap<object, number>();

export function dataRevision(client: object): number {
  return revisions.get(client) ?? 0;
}

/** Вызывать после успешного commit, чтобы не закэшировать прежний снимок. */
export function invalidateDataCache(client: object): void {
  revisions.set(client, dataRevision(client) + 1);
}
