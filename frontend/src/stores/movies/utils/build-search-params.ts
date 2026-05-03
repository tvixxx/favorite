import type { MoviesFilters } from "@/stores";

export const buildSearchParams = (
  filters: MoviesFilters,
  query?: string
): URLSearchParams => {
  const params = new URLSearchParams();

  if (query) {
    params.append("q", query);
  }

  for (const g of filters.genres ?? []) {
    params.append("genres", g);
  }

  for (const c of filters.countryCodes ?? []) {
    params.append("countryCode", c);
  }

  if (filters.publishDateFrom) {
    params.append("publishDateFrom", filters.publishDateFrom);
  }

  if (filters.publishDateTo) {
    params.append("publishDateTo", filters.publishDateTo);
  }

  return params;
};
