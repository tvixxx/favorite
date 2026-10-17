export type ContentKind = "GENERAL" | "ANIME" | "ANIMATION" | "TV_SHOW";

export const contentKindOptions: { value: ContentKind; label: string }[] = [
  { value: "GENERAL", label: "Кино и сериалы" },
  { value: "ANIME", label: "Аниме" },
  { value: "ANIMATION", label: "Мультфильмы" },
  { value: "TV_SHOW", label: "ТВ-шоу" },
];

export interface ContentSelection {
  contentKind: ContentKind | null;
  isSerial: boolean | null;
}

export function contentTypeLabel(movie: { contentKind?: ContentKind | null; isSerial?: boolean | null }): string {
  switch (movie.contentKind) {
    case "ANIME": return movie.isSerial ? "Аниме · сериал" : "Аниме · фильм";
    case "ANIMATION": return movie.isSerial ? "Мультсериал" : "Мультфильм";
    case "TV_SHOW": return movie.isSerial ? "ТВ-шоу · выпуски" : "ТВ-шоу · разовая программа";
    default: return movie.isSerial ? "Сериал" : "Фильм";
  }
}
