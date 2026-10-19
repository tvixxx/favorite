import { describe, expect, it } from "vitest";
import {
  prepareDiaryValues,
  diaryMonthRange,
  type DiaryDraft,
  type DiaryMovie,
} from "./watch-diary";

const movie: DiaryMovie = {
  id: "movie",
  title: "Интерстеллар",
  titleEn: "Interstellar",
  isSerial: false,
  seasonCount: null,
  contentKind: "GENERAL",
  publishDate: null,
  imageUrl: null,
};
const draft: DiaryDraft = {
  viewedOn: "2026-10-17",
  scope: "TITLE",
  season: undefined,
  isRewatch: false,
  rating: null,
  note: "",
  syncStatus: false,
  syncRating: false,
};

describe("Подготовка записи дневника", () => {
  it("оставляет текущую коллекцию неизменной по умолчанию и сохраняет отдельную оценку просмотра", () => {
    expect(
      prepareDiaryValues(
        { ...draft, rating: 10, note: "  Пересмотр <3  " },
        movie,
        "2026-10-17"
      )
    ).toEqual({
      viewedOn: "2026-10-17",
      scope: "TITLE",
      season: null,
      isRewatch: false,
      rating: 10,
      note: "Пересмотр <3",
      syncStatus: false,
      syncRating: false,
    });
  });

  it.each(["2026-10-18", "2026-02-30", "", "17.10.2026"])(
    "не отправляет неподходящую дату %s",
    (viewedOn) => {
      expect(() =>
        prepareDiaryValues({ ...draft, viewedOn }, movie, "2026-10-17")
      ).toThrow();
    }
  );

  it("использует полученный календарный день и не пересчитывает дату просмотра по часовому поясу браузера", () => {
    expect(
      prepareDiaryValues(
        { ...draft, viewedOn: "2026-10-18" },
        movie,
        "2026-10-18"
      ).viewedOn
    ).toBe("2026-10-18");
  });

  it("не разрешает сезону завершать весь сериал и не отправляет ошибочное числовое значение", () => {
    const serial = { ...movie, isSerial: true, seasonCount: 3 };

    expect(() =>
      prepareDiaryValues(
        { ...draft, scope: "SEASON", season: 1, syncStatus: true },
        serial,
        "2026-10-17"
      )
    ).toThrow();

    expect(() =>
      prepareDiaryValues(
        { ...draft, scope: "SEASON", season: Number.NaN },
        serial,
        "2026-10-17"
      )
    ).toThrow();

    expect(() =>
      prepareDiaryValues(
        { ...draft, scope: "SEASON", season: -1 },
        serial,
        "2026-10-17"
      )
    ).toThrow();

    expect(() =>
      prepareDiaryValues(
        { ...draft, scope: "SEASON", season: 4 },
        serial,
        "2026-10-17"
      )
    ).toThrow();

    expect(
      prepareDiaryValues(
        { ...draft, scope: "SEASON", season: 2 },
        serial,
        "2026-10-17"
      ).season
    ).toBe(2);
  });

  it("проверяет оценку и заметку перед записью", () => {
    expect(() =>
      prepareDiaryValues({ ...draft, rating: 11 }, movie, "2026-10-17")
    ).toThrow();

    expect(() =>
      prepareDiaryValues({ ...draft, syncRating: true }, movie, "2026-10-17")
    ).toThrow();

    expect(() =>
      prepareDiaryValues(
        { ...draft, note: "x".repeat(501) },
        movie,
        "2026-10-17"
      )
    ).toThrow();

    expect(() =>
      prepareDiaryValues({ ...draft, note: "text\u0000" }, movie, "2026-10-17")
    ).toThrow();
  });

  it("строит включительный месяц для високосного февраля и декабря", () => {
    expect(diaryMonthRange("2024-02")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });

    expect(diaryMonthRange("2026-12")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });

    expect(diaryMonthRange("")).toEqual({});
  });
});
