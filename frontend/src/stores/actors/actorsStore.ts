import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { API_BASE_URL } from "@/constants/api/endpoints";
import { FETCH_METHOD, useFetch } from "@/composable";
import { isSuccessStatus } from "@/utils";
import { ACTORS_ENDPOINT } from "@/constants";
import { createRequestGuard } from "@/utils/requestGuard";

export interface Actor {
  id: string;
  name: string;
}

export interface ActorsListResponse {
  items: Actor[];
  total: number;
  limit: number;
  offset: number;
}

const PICKER_LIMIT = 500;
const API_PAGE_LIMIT = 100;

export const ACTORS_STORE_NAME = "actorsStore";

export const useActorsStore = defineStore(ACTORS_STORE_NAME, () => {
  /** Список на странице «Актёры» (серверная пагинация / поиск). */
  const actorsPageItems = ref<Actor[]>([]);
  const actorsPageTotal = ref(0);
  const actorsPageSize = ref(20);
  const actorsPageCurrent = ref(1);
  const actorsSearchQ = ref("");

  /** Актёры для селектов (создание фильма, топ и т.д.). */
  const pickerActors = ref<Actor[]>([]);

  const detailActor = ref<Actor | null>(null);

  const isPageLoading = ref(false);
  const isPickerLoading = ref(false);
  const isActorsLoading = computed(() => isPageLoading.value || isPickerLoading.value);
  const isActorsError = ref<string | null>(null);
  const isActorsLoaded = ref(false);

  const pageRequests = createRequestGuard();
  const detailRequests = createRequestGuard();
  const pickerRequests = createRequestGuard();
  let pickerRequest: Promise<void> | null = null;

  const setErrorActors = (errorText: string | null) => {
    isActorsError.value = errorText;
  };

  function buildListParams(opts: {
    q?: string;
    limit: number;
    offset: number;
  }): string {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit));
    params.set("offset", String(opts.offset));
    if (opts.q?.trim()) {
      params.set("q", opts.q.trim());
    }

    return params.toString();
  }

  /** Список с пагинацией и поиском по имени (для страницы «Актёры»). */
  const fetchActorsPage = async (opts?: {
    q?: string;
    page?: number;
    pageSize?: number;
  }) => {
    if (opts?.q !== undefined) {
      actorsSearchQ.value = opts.q;
    }

    if (opts?.pageSize !== undefined) {
      actorsPageSize.value = opts.pageSize;
    }

    if (opts?.page !== undefined) {
      actorsPageCurrent.value = opts.page;
    }

    const isCurrent = pageRequests.begin();
    const limit = Math.min(API_PAGE_LIMIT, Math.max(1, actorsPageSize.value));
    actorsPageSize.value = limit;
    const offset = (actorsPageCurrent.value - 1) * limit;

    isPageLoading.value = true;
    setErrorActors(null);

    try {
      const qs = buildListParams({
        q: actorsSearchQ.value,
        limit,
        offset,
      });
      const { data, status } = await useFetch<ActorsListResponse>(
        `${API_BASE_URL}/actors?${qs}`,
      );
      if (!isCurrent()) return;

      if (status !== 200) {
        throw new Error("Ошибка загрузки актёров");
      }

      actorsPageItems.value = data.items;
      actorsPageTotal.value = data.total;
    } catch {
      if (!isCurrent()) return;
      setErrorActors("Ошибка загрузки актёров");
      throw new Error("Ошибка загрузки актёров");
    } finally {
      if (isCurrent()) isPageLoading.value = false;
    }
  };

  /** Загрузка среза для выпадающих списков (до PICKER_LIMIT записей). */
  const loadPickerActors = async () => {
    const isCurrent = pickerRequests.begin();
    isPickerLoading.value = true;
    setErrorActors(null);

    try {
      const items: Actor[] = [];
      let total = PICKER_LIMIT;
      while (items.length < Math.min(total, PICKER_LIMIT)) {
        const qs = buildListParams({ limit: API_PAGE_LIMIT, offset: items.length });
        const { data, status } = await useFetch<ActorsListResponse>(`${API_BASE_URL}/actors?${qs}`);
        if (!isCurrent()) return;
        if (status !== 200) throw new Error("Ошибка загрузки актёров");
        total = data.total;
        items.push(...data.items);
        if (!data.items.length) break;
      }

      pickerActors.value = items.slice(0, PICKER_LIMIT);
      isActorsLoaded.value = true;
    } catch (err) {
      if (!isCurrent()) return;
      setErrorActors("Ошибка загрузки актёров");
      throw err;
    } finally {
      if (isCurrent()) isPickerLoading.value = false;
    }
  };

  const fetchActorsForPickers = (): Promise<void> => {
    if (pickerRequest) return pickerRequest;
    const request = loadPickerActors().finally(() => {
      if (pickerRequest === request) pickerRequest = null;
    });
    pickerRequest = request;

    return request;
  };

  const fetchActorById = async (id: string): Promise<Actor | null> => {
    const isCurrent = detailRequests.begin();
    try {
      const { data, status } = await useFetch<Actor>(
        `${ACTORS_ENDPOINT}/${id}`,
      );
      if (!isCurrent()) return null;
      if (status === 200 && data) {
        detailActor.value = data;

        return data;
      }
    } catch {
      /* */
    }

    if (isCurrent()) detailActor.value = null;

    return null;
  };

  const clearDetailActor = () => {
    detailRequests.invalidate();
    detailActor.value = null;
  };

  const createActor = async (actorData: Omit<Actor, "id">): Promise<Actor> => {
    const response = await useFetch<Actor>(`${ACTORS_ENDPOINT}`, {
      method: FETCH_METHOD.post,
      data: actorData,
    });

    if (isSuccessStatus(response.status) && response.data) {
      const newActor = response.data;
      if (!pickerActors.value.some((a) => a.id === newActor.id)) {
        pickerActors.value.push(newActor);
      }

      return newActor;
    }

    throw new Error("Не удалось создать актера");
  };

  const pendingActorsByName = new Map<string, Promise<Actor>>();
  const addActorByName = async (name: string): Promise<Actor> => {
    const normalized = name.trim();
    if (!normalized) throw new Error("Введите имя актёра");
    const existingActor = pickerActors.value.find(
      (actor) => actor.name.trim().toLowerCase() === normalized.toLowerCase(),
    );

    if (existingActor) {
      return existingActor;
    }

    const key = normalized.toLowerCase();
    const existingRequest = pendingActorsByName.get(key);
    if (existingRequest) return existingRequest;
    const request = createActor({ name: normalized }).finally(() => pendingActorsByName.delete(key));
    pendingActorsByName.set(key, request);

    return request;
  };

  return {
    actorsPageItems,
    actorsPageTotal,
    actorsPageSize,
    actorsPageCurrent,
    actorsSearchQ,
    pickerActors,
    detailActor,

    isActorsLoaded,
    isActorsLoading,
    isPageLoading,
    isPickerLoading,
    isActorsError,

    fetchActorsPage,
    fetchActorsForPickers,
    fetchActorById,
    clearDetailActor,

    createActor,
    addActorByName,
  };
});
