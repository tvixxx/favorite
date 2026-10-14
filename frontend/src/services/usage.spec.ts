import { describe, expect, it } from "vitest";
import { usageFeature } from "./usage-feature";

describe("События использования без содержимого запросов", () => {
  it("отмечает поиск, но не переносит введённый текст в событие", () => {
    expect(
      usageFeature(
        "http://localhost:3005/movies/page?q=private-text&limit=20",
        "GET"
      )
    ).toBe("SEARCH");
    expect(usageFeature("/movies/page?limit=20", "GET")).toBeNull();
  });

  it("не считает догрузку новым поиском", () => {
    expect(usageFeature("/movies/page?q=test&offset=20", "GET")).toBeNull();
  });

  it("не отслеживает админку, авторизацию и собственную отправку аналитики", () => {
    for (const path of ["/admin/users", "/auth/login", "/usage-events"]) {
      expect(usageFeature(path, "POST")).toBeNull();
    }
  });

  it("различает сохранение оценки и добавление в коллекцию", () => {
    expect(usageFeature("/users/user/movies", "POST")).toBe("COLLECTION_ADD");
    expect(usageFeature("/users/user/movies/import", "POST")).toBe("COLLECTION_ADD");
    expect(usageFeature("/users/user/movies/import/check", "POST")).toBeNull();
    expect(usageFeature("/users/user/movies/movie/rating", "PATCH")).toBe(
      "RATING"
    );
  });

  it("учитывает создание с коллекцией и редактирование отзыва", () => {
    expect(usageFeature("/movies", "POST", { collection: {} })).toBe(
      "COLLECTION_ADD"
    );
    expect(usageFeature("/api/movies", "POST", { collection: {} })).toBe(
      "COLLECTION_ADD"
    );
    expect(
      usageFeature("/movies", "POST", { title: "Только каталог" })
    ).toBeNull();
    expect(usageFeature("/reviews/review-id", "PATCH")).toBe("REVIEW");
  });
});
