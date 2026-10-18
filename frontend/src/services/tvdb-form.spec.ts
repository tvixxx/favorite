import { describe, expect, it } from "vitest";
import { prepareTvdbImport } from "./tvdb-form";
import { Genre } from "@/components/Genres/constants/genres.constants";

const preview = () => ({
  id: "247824",
  type: "series" as const,
  title: "",
  titleEn: "The Voice",
  originalTitle: "The Voice",
  description: "English description",
  descriptionLanguage: "en" as const,
  contentKind: "TV_SHOW" as const,
  isSerial: true,
  countryCodes: ["US"],
  genres: [Genre.MUSICAL],
  seasonCount: null,
  episodeCount: null,
});

describe("Подтверждение карточки TheTVDB", () => {
  it("требует выбрать статус просмотра при положительном прогрессе", () => {
    expect(() =>
      prepareTvdbImport(preview(), { title: "Название" }, { currentEpisode: 5 })
    ).toThrow("статус");
  });

  it("требует название для русского интерфейса и сохраняет явно помеченное английское описание", () => {
    expect(() => prepareTvdbImport(preview(), {}, {})).toThrow("название");
    expect(
      prepareTvdbImport(preview(), { title: "Голос США" }, {})
    ).toMatchObject({
      id: "247824",
      type: "series",
      title: "Голос США",
      description: "English description",
      descriptionLanguage: "en",
      collection: { watchStatus: "NOT_STARTED", seeLater: true },
    });
  });

  it("не пропускает пустое описание, страну или жанр", () => {
    for (const edit of [
      { description: " " },
      { countryCodes: [] },
      { genres: [] },
    ]) {
      expect(() =>
        prepareTvdbImport(preview(), { title: "Название", ...edit }, {})
      ).toThrow();
    }
  });

  it("отклоняет превышающий известные пределы прогресс без тихого обрезания", () => {
    expect(() =>
      prepareTvdbImport(
        { ...preview(), episodeCount: 10 },
        { title: "Название" },
        { watchStatus: "WATCHING", currentEpisode: 11 }
      )
    ).toThrow("прогресс");
  });

  it("при неизвестных пределах принимает общий счётчик просмотренных серий", () => {
    expect(
      prepareTvdbImport(
        preview(),
        { title: "Название" },
        { watchStatus: "WATCHING", currentEpisode: 8 }
      )
    ).toMatchObject({
      collection: { currentEpisode: 8, watchStatus: "WATCHING" },
    });
  });

  it("для существующей карточки отправляет только выбор и личные параметры", () => {
    const result = prepareTvdbImport(
      preview(),
      {},
      {},
      "00000000-0000-4000-8000-000000000001"
    );

    expect(result).toEqual({
      id: "247824",
      type: "series",
      existingMovieId: "00000000-0000-4000-8000-000000000001",
      collection: { watchStatus: "NOT_STARTED", seeLater: true },
    });
  });
});
