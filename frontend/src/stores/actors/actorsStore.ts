import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { API_BASE_URL } from "@/constants/api/endpoints";
import { FETCH_METHOD, useFetch } from "@/composable";
import { isSuccessStatus } from "@/utils";
import { ACTORS_ENDPOINT } from "@/constants";

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

  const isActorsLoading = ref(false);
  const isActorsError = ref<string | null>(null);
  const isActorsLoaded = ref(false);

  const setLoadingActors = (value: boolean) => {
    isActorsLoading.value = value;
  };

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

    const limit = actorsPageSize.value;
    const offset = (actorsPageCurrent.value - 1) * limit;

    setLoadingActors(true);
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

      if (status !== 200) {
        throw new Error("Ошибка загрузки актёров");
      }

      actorsPageItems.value = data.items;
      actorsPageTotal.value = data.total;
    } catch {
      setErrorActors("Ошибка загрузки актёров");
      throw new Error("Ошибка загрузки актёров");
    } finally {
      setLoadingActors(false);
    }
  };

  /** Лёгкий запрос только для обновления total (например, бейдж в шапке медиатеки). */
  const prefetchActorsTotal = async () => {
    try {
      const qs = buildListParams({ limit: 1, offset: 0 });
      const { data, status } = await useFetch<ActorsListResponse>(
        `${API_BASE_URL}/actors?${qs}`,
      );
      if (status === 200) {
        actorsPageTotal.value = data.total;
      }
    } catch {
      /* ignore */
    }
  };

  /** Загрузка среза для выпадающих списков (до PICKER_LIMIT записей). */
  const fetchActorsForPickers = async () => {
    setLoadingActors(true);
    setErrorActors(null);

    try {
      const qs = buildListParams({ limit: PICKER_LIMIT, offset: 0 });
      const { data, status } = await useFetch<ActorsListResponse>(
        `${API_BASE_URL}/actors?${qs}`,
      );

      if (status !== 200) {
        throw new Error("Ошибка загрузки актёров");
      }

      pickerActors.value = data.items;
      isActorsLoaded.value = true;
    } catch (err) {
      setErrorActors("Ошибка загрузки актёров");
      throw err;
    } finally {
      setLoadingActors(false);
    }
  };

  /** Совместимость: старый вызов fetchActors → загрузка для селектов. */
  const fetchActors = fetchActorsForPickers;

  const fetchActorById = async (id: string): Promise<Actor | null> => {
    try {
      const { data, status } = await useFetch<Actor>(
        `${ACTORS_ENDPOINT}/${id}`,
      );
      if (status === 200 && data) {
        detailActor.value = data;

        return data;
      }
    } catch {
      /* */
    }

    detailActor.value = null;

    return null;
  };

  const clearDetailActor = () => {
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

  const addActorByName = async (name: string): Promise<Actor> => {
    const existingActor = pickerActors.value.find(
      (actor) => actor.name.toLowerCase() === name.toLowerCase(),
    );

    if (existingActor) {
      return existingActor;
    }

    return await createActor({ name });
  };

  const getAllActors = computed(() => pickerActors.value);

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
    isActorsError,

    getAllActors,

    setLoadingActors,
    setErrorActors,

    fetchActorsPage,
    prefetchActorsTotal,
    fetchActorsForPickers,
    fetchActors,
    fetchActorById,
    clearDetailActor,

    createActor,
    addActorByName,
  };
});
