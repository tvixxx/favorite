import type { Router } from "vue-router";

export function buildMovieDetailAbsoluteUrl(
  router: Router,
  movieId: string,
  movieTitle?: string,
): string {
  const { fullPath } = router.resolve({
    name: "detail",
    params: { id: movieId },
    query: movieTitle?.trim() ? { shareTitle: movieTitle.trim() } : undefined,
  });

  if (typeof window === "undefined") {
    return fullPath;
  }

  return `${window.location.origin}${fullPath}`;
}
