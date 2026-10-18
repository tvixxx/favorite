import { describe, expect, it } from "vitest";
import { buildSearchParams } from "./build-search-params";
import { buildUserSearchParams } from "@/stores/userMovies/build-user-search-params";

describe("Категория дополняет прежний фильтр серийности", () => {
  it.each([buildSearchParams, buildUserSearchParams])(
    "передаёт аниме вместе с явным выбором фильмов",
    (build) => {
      const params = build({ contentKind: "ANIME", isSerial: false });

      expect(params.get("contentKind")).toBe("ANIME");
      expect(params.get("isSerial")).toBe("false");
    }
  );

  it("не добавляет категорию в старый запрос сериалов", () => {
    const params = buildUserSearchParams({ isSerial: true });

    expect(params.get("isSerial")).toBe("true");
    expect(params.has("contentKind")).toBe(false);
  });
});
