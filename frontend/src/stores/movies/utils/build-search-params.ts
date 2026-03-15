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

  if (filters.rateMin !== undefined) {
    params.append("rateMin", String(filters.rateMin));
  }

  if (filters.rateMax !== undefined) {
    params.append("rateMax", String(filters.rateMax));
  }

  if (filters.dateFrom) {
    params.append("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.append("dateTo", filters.dateTo);
  }

  if (filters.publishDateFrom) {
    params.append("publishDateFrom", filters.publishDateFrom);
  }

  if (filters.publishDateTo) {
    params.append("publishDateTo", filters.publishDateTo);
  }

  if (filters.seeLater !== undefined) {
    params.append("seeLater", String(filters.seeLater));
  }

  return params;
};
