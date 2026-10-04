import type { Router } from "vue-router";

export function buildMovieDetailAbsoluteUrl(
  router: Router,
  movieId: string,
  movieTitle?: string,
): string {
  const { href } = router.resolve({
    name: "detail",
    params: { id: movieId },
    query: movieTitle?.trim() ? { shareTitle: movieTitle.trim() } : undefined,
  });

  if (typeof window === "undefined") {
    return href;
  }

  return new URL(href, window.location.origin).href;
}
