import { onScopeDispose, ref, shallowRef, watch } from "vue";
import api from "@/services/api";
import { useRoute, useRouter } from "vue-router";

export function useAdminPage<T>(
  endpoint: string,
  filters: () => Record<string, string> = () => ({}),
  pageKey?: string
) {
  const route = pageKey ? useRoute() : undefined;
  const router = pageKey ? useRouter() : undefined;
  const urlPage = (): number => {
    const raw = pageKey ? route?.query[pageKey] : undefined;
    const value = typeof raw === "string" ? Number(raw) : 1;

    return Number.isSafeInteger(value) && value > 0 && value <= 50_001
      ? value
      : 1;
  };

  const items = shallowRef<T[]>([]);
  const total = ref(0);
  const page = ref(urlPage());
  const loading = ref(false);
  const error = ref("");
  const quality = ref<Record<string, number>>({});
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestedKey = "";
  const paramsFor = (nextPage: number) => ({
    ...Object.fromEntries(
      Object.entries(filters()).filter(([, value]) => value !== "")
    ),
    limit: 20,
    offset: (nextPage - 1) * 20,
  });

  async function load(
    nextPage = pageKey ? urlPage() : page.value
  ): Promise<void> {
    const request = ++revision;
    clearTimeout(timer);
    const params = paramsFor(nextPage);

    requestedKey = JSON.stringify(params);

    loading.value = true;
    error.value = "";

    try {
      const { data } = await api.get<{
        items: T[];
        total: number;
        quality?: Record<string, number>;
      }>(endpoint, {
        params,
      });

      if (request !== revision) {
        return;
      }

      const lastPage = Math.max(1, Math.ceil(data.total / 20));

      if (nextPage > lastPage) {
        await load(lastPage);

        return;
      }

      items.value = data.items;
      total.value = data.total;
      quality.value = data.quality ?? {};
      page.value = nextPage;

      if (router && route && pageKey && urlPage() !== nextPage) {
        await router.replace({
          query: {
            ...route.query,
            [pageKey]: nextPage > 1 ? String(nextPage) : undefined,
          },
        });
      }
    } catch {
      if (request === revision) {
        error.value = "Не удалось загрузить данные. Повторите запрос.";
      }
    } finally {
      if (request === revision) {
        loading.value = false;
      }
    }
  }

  watch(
    () => ({ filters: filters(), urlPage: urlPage() }),
    () => {
      const nextPage = pageKey ? urlPage() : 1;

      if (requestedKey === JSON.stringify(paramsFor(nextPage))) {
        return;
      }

      revision += 1;
      clearTimeout(timer);
      timer = setTimeout(() => void load(nextPage), 300);
    },
    { deep: true }
  );

  onScopeDispose(() => {
    revision += 1;
    clearTimeout(timer);
  });

  return { items, total, page, loading, error, quality, load };
}
