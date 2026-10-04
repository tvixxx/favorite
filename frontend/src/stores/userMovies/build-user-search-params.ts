import type { UserMoviesFilters } from "@/stores/movies/types";
import { buildSearchParams } from "@/stores/movies/utils/build-search-params";

export function buildUserSearchParams(filters: UserMoviesFilters, query?: string): URLSearchParams {
  const params = buildSearchParams(filters, query);

  for (const key of ["personalRateMin", "personalRateMax", "isFavorite", "seeLater", "watchStatus", "isSerial"] as const) {
    const value = filters[key];
    if (value !== undefined) params.set(key, String(value));
  }

  return params;
}
