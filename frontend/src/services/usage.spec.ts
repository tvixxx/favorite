import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usageFeature } from "./usage-feature";
import { trackUsage } from "./usage";

const auth = vi.hoisted(() => ({ token: "fixture-access" as string | null }));

vi.mock("@/state/state", () => ({
  useMainStore: () => ({ accessToken: auth.token }),
}));

describe("События использования без содержимого запросов", () => {
  it("распознаёт поиск по непустой строке", () => {
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
    expect(usageFeature("/users/user/movies/import", "POST")).toBe(
      "COLLECTION_ADD"
    );

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

describe("Фактическая отправка аналитики", () => {
  const transport = vi.fn<(url: string, init: RequestInit) => Promise<void>>();

  beforeEach(() => {
    auth.token = "fixture-access";
    transport.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", transport);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    {
      url: "/movies/page?q=private-search&limit=20",
      method: "GET",
      data: undefined,
      feature: "SEARCH",
    },
    {
      url: "/reviews/private-review",
      method: "PATCH",
      data: { text: "private-review-text", rate: 8 },
      feature: "REVIEW",
    },
  ])(
    "отправляет $feature без адреса и содержимого пользовательского запроса",
    ({ url, method, data, feature }) => {
      trackUsage(url, method, data);

      expect(transport).toHaveBeenCalledTimes(1);

      const [destination, request] = transport.mock.calls[0];

      expect(new URL(destination, "https://example.test").pathname).toBe(
        "/usage-events"
      );

      expect(request.method).toBe("POST");
      expect(request.headers).toMatchObject({
        Authorization: "Bearer fixture-access",
      });

      expect(JSON.parse(String(request.body))).toEqual({
        id: expect.any(String),
        feature,
      });

      expect(JSON.parse(String(request.body)).id).toMatch(/^[0-9a-f-]{36}$/i);
    }
  );

  it("не отправляет событие без авторизованной сессии", () => {
    auth.token = null;
    trackUsage("/movies/page?q=private-search", "GET");
    expect(transport).not.toHaveBeenCalled();
  });
});
