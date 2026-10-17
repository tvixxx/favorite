import { describe, expect, it } from "vitest";
import { mapMovieFromApi } from "./map-movie";
import type { MovieApiResponse } from "../types/movies.types";

describe("Категория в полученной карточке", () => {
  it("сохраняет аниме и прежний прогресс серий при преобразовании ответа", () => {
    const raw = { id: "anime", title: "Аниме", isSerial: true, seasonCount: 2, episodeCount: 24, contentKind: "ANIME" } as unknown as MovieApiResponse;
    expect(mapMovieFromApi(raw)).toMatchObject({ id: "anime", contentKind: "ANIME", isSerial: true, seasonCount: 2, episodeCount: 24 });
  });
  it.each([true, false])("не угадывает категорию старой карточки с серийностью %s", (isSerial) => {
    const raw = { id: "legacy", title: "Старая карточка", isSerial } as MovieApiResponse;
    expect(mapMovieFromApi(raw)).toMatchObject({ id: "legacy", contentKind: null, isSerial });
  });
});
