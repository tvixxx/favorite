import type { MoviesFilters } from "@/stores";

export const buildSearchParams = (
  filters: MoviesFilters,
  query?: string
): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.contentKind) params.set("contentKind", filters.contentKind);
  if (filters.isSerial !== undefined) params.set("isSerial", String(filters.isSerial));

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

  for (const id of filters.actorIds ?? []) {
    params.append("actorIds", id);
  }

  return params;
};
