import type { Router } from "vue-router";

export function buildMovieDetailAbsoluteUrl(
  router: Router,
  movieId: string,
): string {
  const { fullPath } = router.resolve({
    name: "detail",
    params: { id: movieId },
  });

  if (typeof window === "undefined") {
    return fullPath;
  }

  return `${window.location.origin}${fullPath}`;
}
