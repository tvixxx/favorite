/** Модель advisory-lock для тестов двух конкурирующих транзакций. */
export function transactionRunner<T extends object>(client: T) {
  const pending = new Map<string, Promise<void>>();

  return async <R>(
    callback: (
      tx: T & { $executeRaw: (...args: unknown[]) => Promise<number> },
    ) => Promise<R>,
  ): Promise<R> => {
    const releases: Array<() => void> = [];
    const tx = {
      ...client,
      $executeRaw: async (_sql: unknown, key: unknown): Promise<number> => {
        const name = String(key);
        const previous = pending.get(name) ?? Promise.resolve();
        let release!: () => void;
        const lock = new Promise<void>((resolve) => {
          release = resolve;
        });

        pending.set(name, lock);
        await previous;
        releases.push(() => {
          release();

          if (pending.get(name) === lock) {
            pending.delete(name);
          }
        });

        return 1;
      },
    };

    try {
      return await callback(tx);
    } finally {
      releases.forEach((release) => release());
    }
  };
}
