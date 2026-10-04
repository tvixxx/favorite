import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";
import { buildMovieDetailAbsoluteUrl } from "./movieShareLink";

describe("Ссылки на фильм", () => {
  it("сохраняет base URL приложения при построении абсолютной ссылки", () => {
    const router = createRouter({ history: createMemoryHistory("/favourite/"), routes: [{ name: "detail", path: "/detail/:id", component: {} }] });
    const url = new URL(buildMovieDetailAbsoluteUrl(router, "movie-id", "Название"));
    expect(url.pathname).toBe("/favourite/detail/movie-id");
    expect(url.searchParams.get("shareTitle")).toBe("Название");
  });
});
