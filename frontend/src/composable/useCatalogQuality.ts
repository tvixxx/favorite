import { onScopeDispose, readonly, shallowRef, watch } from "vue";
import api from "@/services/api";
import {
  diagnoseCatalog,
  posterAddress,
  probePoster,
  type CatalogFinding,
  type CatalogRecord,
  type PosterCheck,
} from "@/utils/catalogQuality";

export function useCatalogQuality(filters: () => Record<string, string>) {
  const status = shallowRef<
    "idle" | "running" | "done" | "cancelled" | "error"
  >("idle");
  const findings = shallowRef<CatalogFinding[]>([]);
  const error = shallowRef("");
  const checkedAt = shallowRef<Date | null>(null);
  const progress = shallowRef({
    loaded: 0,
    total: 0,
    posters: 0,
    posterTotal: 0,
  });
  let controller: AbortController | undefined;

  function cancel(): void {
    const previous = controller;
    controller = undefined;
    previous?.abort();
    if (status.value === "running") status.value = "cancelled";
  }

  function reset(): void {
    cancel();
    status.value = "idle";
    findings.value = [];
    error.value = "";
    checkedAt.value = null;
  }

  async function run(checkPosters: boolean): Promise<void> {
    reset();
    if (!navigator.onLine) {
      status.value = "error";
      error.value = "Нет соединения. Проверка не запускалась.";

      return;
    }

    const current = new AbortController();
    controller = current;
    status.value = "running";
    progress.value = { loaded: 0, total: 0, posters: 0, posterTotal: 0 };
    try {
      const records: CatalogRecord[] = [];
      let expected: number | undefined;
      do {
        const { data } = await api.get<{
          items: CatalogRecord[];
          total: number;
        }>("/admin/movies", {
          params: {
            ...Object.fromEntries(
              Object.entries(filters()).filter(([, value]) => value !== "")
            ),
            limit: 100,
            offset: records.length,
            sort: "oldest",
          },
          signal: current.signal,
        });
        if (controller !== current) return;
        if (
          !Number.isSafeInteger(data.total) ||
          data.total < 0 ||
          (expected !== undefined && data.total !== expected) ||
          (!data.items.length && records.length < data.total)
        ) {
          error.value =
            "Каталог изменился во время проверки. Запустите её заново.";
          throw new Error(error.value);
        }

        expected = data.total;
        records.push(...data.items);
        progress.value = {
          ...progress.value,
          loaded: records.length,
          total: expected,
        };
      } while (records.length < expected);

      if (new Set(records.map((record) => record.id)).size !== expected) {
        error.value =
          "Каталог изменился во время проверки. Запустите её заново.";
        throw new Error(error.value);
      }

      const posters: Record<string, PosterCheck> = {};
      if (checkPosters) {
        const urls = new Map<string, string[]>();
        for (const movie of records) {
          const address =
            movie.poster && !movie.poster.assetId
              ? posterAddress(movie.poster.url)
              : null;
          if (!address || address.origin === location.origin) continue;
          const ids = urls.get(address.href) ?? [];
          ids.push(movie.id);
          urls.set(address.href, ids);
        }

        const entries = [...urls];
        progress.value = { ...progress.value, posterTotal: entries.length };
        for (let index = 0; index < entries.length; index += 3) {
          if (!navigator.onLine) {
            error.value = "Соединение пропало. Проверка не завершена.";
            throw new Error(error.value);
          }

          await Promise.all(
            entries.slice(index, index + 3).map(async ([url, ids]) => {
              const result = await probePoster(url, current.signal);
              for (const id of ids) posters[id] = result;
              if (controller === current)
                progress.value = {
                  ...progress.value,
                  posters: progress.value.posters + 1,
                };
            })
          );
        }
      }

      if (controller !== current) return;
      if (!navigator.onLine) throw new Error("Соединение пропало");
      findings.value = diagnoseCatalog(records, posters);
      checkedAt.value = new Date();
      status.value = "done";
    } catch {
      if (controller !== current) return;
      current.abort();
      error.value ||= "Проверка не завершена. Повторите запрос.";
      status.value = "error";
    } finally {
      if (controller === current) controller = undefined;
    }
  }

  watch(() => JSON.stringify(filters()), reset);
  onScopeDispose(cancel);

  return {
    status: readonly(status),
    findings: readonly(findings),
    error: readonly(error),
    checkedAt: readonly(checkedAt),
    progress: readonly(progress),
    run,
    cancel,
    reset,
  };
}
