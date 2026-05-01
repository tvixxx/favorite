import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { FETCH_METHOD, useFetch } from "@/composable";
import { isSuccessStatus } from "@/utils";

export type LeaderboardSortBy =
  | "totalScore"
  | "registeredAt"
  | "films"
  | "serialsCompleted"
  | "serialsTotal";

export type LeaderboardSortOrder = "asc" | "desc";

export interface LeaderboardBadgePreview {
  id: string;
  title: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  category: string;
}

export interface LeaderboardUserRow {
  rank: number;
  userId: string;
  displayName: string;
  registeredAt: string;
  filmsCount: number;
  serialsTotal: number;
  serialsCompleted: number;
  totalScore: number;
  badges: LeaderboardBadgePreview[];
}

export interface LeaderboardTopUsersResponse {
  items: LeaderboardUserRow[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 20;

export const useLeaderboardStore = defineStore("leaderboard", () => {
  const items = ref<LeaderboardUserRow[]>([]);
  const total = ref(0);
  const limit = ref(PAGE_SIZE);
  const offset = ref(0);
  const sortBy = ref<LeaderboardSortBy>("totalScore");
  const sortOrder = ref<LeaderboardSortOrder>("desc");
  const isLoading = ref(false);
  const isError = ref<string | null>(null);

  const currentPage = computed(
    () => Math.floor(offset.value / PAGE_SIZE) + 1
  );

  const buildQuery = () => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset.value));
    params.set("sortBy", sortBy.value);
    params.set("sortOrder", sortOrder.value);
    return params.toString();
  };

  const fetchTopUsers = async () => {
    isLoading.value = true;
    isError.value = null;

    try {
      const { data, status } = await useFetch<LeaderboardTopUsersResponse>(
        `/leaderboard/top-users?${buildQuery()}`,
        { method: FETCH_METHOD.get }
      );

      if (!isSuccessStatus(status)) {
        throw new Error("Ошибка загрузки рейтинга");
      }

      items.value = data.items ?? [];
      total.value = data.total ?? 0;
      limit.value = data.limit ?? PAGE_SIZE;
      offset.value = data.offset ?? offset.value;
    } catch {
      isError.value = "Не удалось загрузить рейтинг";
      items.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const setSort = async (by: LeaderboardSortBy, order: LeaderboardSortOrder) => {
    sortBy.value = by;
    sortOrder.value = order;
    offset.value = 0;
    await fetchTopUsers();
  };

  const setPage = async (page: number) => {
    offset.value = (Math.max(1, page) - 1) * PAGE_SIZE;
    await fetchTopUsers();
  };

  return {
    items,
    total,
    limit,
    offset,
    sortBy,
    sortOrder,
    isLoading,
    isError,
    currentPage,
    pageSize: PAGE_SIZE,
    fetchTopUsers,
    setSort,
    setPage,
  };
});
