export type UsageFeature =
  | "SEARCH"
  | "MOVIE_VIEW"
  | "COLLECTION_ADD"
  | "RATING"
  | "REVIEW"
  | "LIST"
  | "FEEDBACK";

export function usageFeature(
  value: string,
  method: string,
  data?: unknown
): UsageFeature | null {
  const url = new URL(value, "http://localhost");
  const path = url.pathname;

  if (
    method === "GET" &&
    /\/movies\/(page|search)$/.test(path) &&
    url.searchParams.get("q")?.trim() &&
    !Number(url.searchParams.get("offset"))
  ) {
    return "SEARCH";
  }

  if (method === "GET" && /\/movies\/[0-9a-f-]{36}$/.test(path)) {
    return "MOVIE_VIEW";
  }

  if (method === "POST" && /\/users\/[^/]+\/movies(?:\/import)?$/.test(path)) {
    return "COLLECTION_ADD";
  }

  if (
    method === "POST" &&
    /^\/(?:api\/)?movies$/.test(path) &&
    data !== null &&
    typeof data === "object" &&
    "collection" in data &&
    data.collection !== null &&
    typeof data.collection === "object"
  ) {
    return "COLLECTION_ADD";
  }

  if (method === "PATCH" && /\/movies\/[^/]+\/rating$/.test(path)) {
    return "RATING";
  }

  if (
    (method === "POST" && /\/reviews$/.test(path)) ||
    (method === "PATCH" && /\/reviews\/[^/]+$/.test(path))
  ) {
    return "REVIEW";
  }

  if (
    method === "POST" &&
    /\/users\/[^/]+\/lists(?:\/[^/]+\/movies)?$/.test(path)
  ) {
    return "LIST";
  }

  return method === "POST" && /\/feedback$/.test(path) ? "FEEDBACK" : null;
}
