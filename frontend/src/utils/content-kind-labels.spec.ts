import { describe, expect, it } from "vitest";
import { movieCardTitle } from "./format-movie.utils";
import { alignChipsToQuotedTitles, expandMessageWithMovieUrls } from "./chatComposeExpand";
import type { Router } from "vue-router";

describe("Подписи категорий и ссылки одноимённых произведений", () => {
  it("оставляет привычные заголовки старых фильмов и сериалов", () => {
    expect(movieCardTitle({ title: "Фильм", isSerial: false })).toBe("Фильм");
    expect(movieCardTitle({ title: "Сериал", isSerial: true })).toBe("Сериал (сериал)");
  });
  it("показывает категорию аниме в заголовке карточки", () => {
    expect(movieCardTitle({ title: "Тайтл", isSerial: true, ...{ contentKind: "ANIME" as const } })).toBe("Тайтл (аниме · сериал)");
  });
  it("не подставляет случайную ссылку при двух чипах с одинаковой подписью", () => {
    const chips = [{ title: "Маяк", movieId: "one" }, { title: "Маяк", movieId: "two" }];
    expect(alignChipsToQuotedTitles("«Маяк»", chips)).toEqual([]);
    expect(expandMessageWithMovieUrls("«Маяк»", chips, {} as Router)).toBe("«Маяк»");
  });
});
