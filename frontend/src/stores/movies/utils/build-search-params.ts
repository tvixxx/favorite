import type { MoviesFilters } from "@/stores";

export const buildSearchParams = (
  filters: MoviesFilters,
  query?: string
): URLSearchParams => {
  const params = new URLSearchParams();

  if (query) {
    params.append("q", query);
  }

  if (filters.genre) {
    params.append("genre", filters.genre);
  }

  if (filters.publishDateFrom) {
    params.append("publishDateFrom", filters.publishDateFrom);
  }

  if (filters.publishDateTo) {
    params.append("publishDateTo", filters.publishDateTo);
  }

  return params;
};
