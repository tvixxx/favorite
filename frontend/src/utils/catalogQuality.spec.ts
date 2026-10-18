import { describe, expect, it } from "vitest";
import { diagnoseCatalog, type CatalogRecord } from "./catalogQuality";

const movie = (
  id: string,
  changes: Partial<CatalogRecord> = {}
): CatalogRecord => ({
  id,
  title: "Пример",
  description: "Описание",
  genres: ["DRAMA"],
  countryCodes: ["RU"],
  publishDate: "2020-01-01T00:00:00Z",
  isSerial: false,
  poster: { url: "https://images.example.test/poster.webp" },
  _count: { actors: 1 },
  ...changes,
});

describe("Диагностика качества каталога", () => {
  it("не отмечает заполненную карточку как проблемную", () => {
    expect(diagnoseCatalog([movie("one")])).toEqual([]);
  });

  it("находит отсутствие данных без изменения тестового тайтла", () => {
    const record = movie("demo", {
      description: "",
      genres: [],
      countryCodes: [],
      publishDate: null,
      poster: null,
      _count: { actors: 0 },
    });
    const before = structuredClone(record);

    expect(diagnoseCatalog([record])[0].issues).toEqual(
      expect.arrayContaining([
        "poster",
        "date",
        "actors",
        "description",
        "genres",
        "countries",
      ])
    );

    expect(record).toEqual(before);
  });

  it("считает различия регистра, ё и пунктуации поводом сравнить записи", () => {
    const result = diagnoseCatalog([
      movie("one", { title: "Самолёт!" }),
      movie("two", { title: "САМОЛЕТ" }),
    ]);

    expect(result.map((row) => row.id)).toEqual(["one", "two"]);
    expect(result[0].duplicates.map((row) => row.id)).toEqual(["two"]);
    expect(result[0].issues).toContain("duplicate");
  });

  it("не путает ремейки разных лет и фильм с сериалом", () => {
    expect(
      diagnoseCatalog([
        movie("old", { title: "Дюна", publishDate: "1984-01-01" }),
        movie("new", { title: "Дюна!", publishDate: "2021-01-01" }),
        movie("serial", {
          title: "Дюна?",
          isSerial: true,
          seasonCount: 1,
          episodeCount: 6,
        }),
      ])
    ).toEqual([]);
  });

  it("оставляет запись без года кандидатом для ручного сравнения", () => {
    const result = diagnoseCatalog([
      movie("dated"),
      movie("undated", { title: "Пример!", publishDate: null }),
    ]);

    expect(result.find((row) => row.id === "dated")?.issues).toContain(
      "duplicate"
    );
  });

  it("сохраняет цифры в названии и не объединяет продолжения", () => {
    expect(
      diagnoseCatalog([
        movie("one", { title: "Пила" }),
        movie("two", { title: "Пила 2" }),
      ])
    ).toEqual([]);
  });

  it("проверяет параметры сериалов и лишние параметры фильма", () => {
    expect(
      diagnoseCatalog([
        movie("serial", {
          isSerial: true,
          seasonCount: 0,
          episodeCount: 10001,
        }),
      ])[0].issues
    ).toContain("serial");

    expect(
      diagnoseCatalog([movie("film", { seasonCount: 1 })])[0].issues
    ).toContain("serial");
  });

  it("не отправляет некорректный адрес постера на сетевую проверку", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "https://user:password@example.test/x",
    ]) {
      expect(
        diagnoseCatalog([movie("invalid", { poster: { url } })])[0].issues
      ).toContain("poster-url");
    }
  });

  it("отличает таймаут проверки от ошибки загрузки изображения", () => {
    const result = diagnoseCatalog(
      [movie("failed"), movie("slow", { title: "Другой" })],
      { failed: "unavailable", slow: "timeout" }
    );

    expect(result.find((row) => row.id === "failed")?.issues).toContain(
      "poster-unavailable"
    );

    expect(result.find((row) => row.id === "slow")?.issues).toContain(
      "poster-timeout"
    );
  });
});
