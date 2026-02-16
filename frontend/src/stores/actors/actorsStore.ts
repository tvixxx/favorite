import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { API_BASE_URL } from "@/constants/api/endpoints";
import { FETCH_METHOD, useFetch } from "@/composable";
import { isSuccessStatus } from "@/utils";
import { showErrorRequest } from "@/state/utils";
import { ACTORS_ENDPOINT } from "@/constants";

export interface Actor {
  id: string;
  name: string;
}

export const ACTORS_STORE_NAME = "actorsStore";

export const useActorsStore = defineStore(ACTORS_STORE_NAME, () => {
  // Actors
  const actorsList = ref<Actor[]>([]);
  const isActorsLoaded = ref<boolean>(false);
  const isActorsLoading = ref(false);
  const isActorsError = ref<string | null>(null);

  const setLoadingActors = (value: boolean) => {
    isActorsLoading.value = value;
  };

  const setErrorActors = (errorText: string | null) => {
    isActorsError.value = errorText;
  };

  const setActors = (items: Actor[]): void => {
    actorsList.value = items;
    isActorsLoaded.value = true;
  };

  const getAllActors = computed(() => actorsList.value);

  const fetchActors = async () => {
    setLoadingActors(true);
    setErrorActors(null);

    try {
      const { data, status } = await useFetch(`${API_BASE_URL}/actors`);

      if (status !== 200) {
        throw new Error("Failed to fetch actors");
      }

      setActors(data);
    } catch (err) {
      setErrorActors("Ошибка загрузки актеров. Пожалуйста, попробуйте позже.");
      console.error(err);
    } finally {
      setLoadingActors(false);
    }
  };

  const createActor = async (
    actorData: Omit<Actor, "id">
  ): Promise<Actor | null> => {
    try {
      const response = await useFetch(`${ACTORS_ENDPOINT}`, {
        method: FETCH_METHOD.post,
        data: actorData,
      });

      if (isSuccessStatus(response.status) && response.data) {
        // Add the new actor to our list
        const newActor: Actor = response.data;
        actorsList.value.push(newActor);
        return newActor;
      }
    } catch (error) {
      showErrorRequest(error);
    }

    return null;
  };

  const addActorByName = async (name: string): Promise<Actor | null> => {
    const existingActor = actorsList.value.find(
      (actor) => actor.name.toLowerCase() === name.toLowerCase()
    );
    if (existingActor) {
      return existingActor;
    }

    return await createActor({ name });
  };

  return {
    // Actors refs
    actorsList,
    isActorsLoaded,
    isActorsLoading,
    isActorsError,

    getAllActors,

    setActors,
    setLoadingActors,
    setErrorActors,

    // Actors
    fetchActors,

    // Actor handlers
    createActor,
    addActorByName,
  };
});
