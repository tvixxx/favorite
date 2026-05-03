import { defineStore } from "pinia";
import { computed, ref } from "vue";
import dayjs, { type Dayjs } from "dayjs";
import { FETCH_METHOD, useFetch } from "@/composable";
import { isSuccessStatus } from "@/utils";
import type { Genre } from "@/components/Genres/constants/genres.constants";

export type LeaderboardMovieSortBy =
  | "avgPersonalRate"
  | "ratingsCount"
  | "title"
  | "publishDate";

export type LeaderboardMovieSortOrder = "asc" | "desc";

export interface LeaderboardMovieRow {
  rank: number;
  movieId: string;
  title: string;
  isSerial: boolean;
  publishDate: string | null;
  posterUrl: string | null;
  avgPersonalRate: number | null;
  ratingsCount: number;
}

export interface LeaderboardTopMoviesResponse {
  items: LeaderboardMovieRow[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 20;

export const useLeaderboardMoviesStore = defineStore(
  "leaderboardMovies",
  () => {
    const items = ref<LeaderboardMovieRow[]>([]);
    const total = ref(0);
    const offset = ref(0);
    const sortBy = ref<LeaderboardMovieSortBy>("avgPersonalRate");
    const sortOrder = ref<LeaderboardMovieSortOrder>("desc");
    const selectedGenres = ref<Genre[]>([]);
    const selectedCountries = ref<string[]>([]);
    const publishDateRange = ref<[Dayjs, Dayjs] | null>(null);
    const actorIds = ref<string[]>([]);
    const personalRateRange = ref<[number, number]>([0, 10]);
    const isLoading = ref(false);
    const isError = ref<string | null>(null);

    const currentPage = computed(
      () => Math.floor(offset.value / PAGE_SIZE) + 1,
    );

    const buildQuery = () => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset.value));
      params.set("sortBy", sortBy.value);
      params.set("sortOrder", sortOrder.value);
      params.set("personalRateMin", String(personalRateRange.value[0]));
      params.set("personalRateMax", String(personalRateRange.value[1]));
      for (const g of selectedGenres.value) {
        params.append("genres", g);
      }

      for (const c of selectedCountries.value) {
        params.append("countryCodes", c);
      }

      for (const id of actorIds.value) {
        params.append("actorIds", id);
      }

      if (publishDateRange.value?.[0]) {
        params.set(
          "publishDateFrom",
          dayjs(publishDateRange.value[0]).startOf("month").toISOString(),
        );
      }

      if (publishDateRange.value?.[1]) {
        params.set(
          "publishDateTo",
          dayjs(publishDateRange.value[1]).endOf("month").toISOString(),
        );
      }

      return params.toString();
    };

    const fetchTopMovies = async () => {
      isLoading.value = true;
      isError.value = null;

      try {
        const { data, status } = await useFetch<LeaderboardTopMoviesResponse>(
          `/leaderboard/top-movies?${buildQuery()}`,
          { method: FETCH_METHOD.get },
        );

        if (!isSuccessStatus(status)) {
          throw new Error("Ошибка загрузки топа фильмов");
        }

        items.value = data.items ?? [];
        total.value = data.total ?? 0;
        offset.value = data.offset ?? offset.value;
      } catch {
        isError.value = "Не удалось загрузить топ фильмов";
        items.value = [];
      } finally {
        isLoading.value = false;
      }
    };

    const setSort = async (
      by: LeaderboardMovieSortBy,
      order: LeaderboardMovieSortOrder,
    ) => {
      sortBy.value = by;
      sortOrder.value = order;
      offset.value = 0;

      await fetchTopMovies();
    };

    const setPage = async (page: number) => {
      offset.value = (Math.max(1, page) - 1) * PAGE_SIZE;
      await fetchTopMovies();
    };

    const clearFilters = () => {
      selectedGenres.value = [];
      selectedCountries.value = [];
      publishDateRange.value = null;
      actorIds.value = [];
      personalRateRange.value = [0, 10];
    };

    /** Сброс на первую страницу и перезагрузка (после смены фильтров). */
    const refreshFromStart = async () => {
      offset.value = 0;
      await fetchTopMovies();
    };

    return {
      items,
      total,
      offset,
      sortBy,
      sortOrder,
      selectedGenres,
      selectedCountries,
      publishDateRange,
      actorIds,
      personalRateRange,
      isLoading,
      isError,
      currentPage,
      pageSize: PAGE_SIZE,
      fetchTopMovies,
      setSort,
      setPage,
      clearFilters,
      refreshFromStart,
    };
  },
);
