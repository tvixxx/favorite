export enum Genre {
  ACTION = "ACTION",
  DRAMA = "DRAMA",
  COMEDY = "COMEDY",
  DETECTIVE = "DETECTIVE",
  FAMILY = "FAMILY",
  FANTASY = "FANTASY",
  HORROR = "HORROR",
  MUSICAL = "MUSICAL",
  ROMANCE = "ROMANCE",
  THRILLER = "THRILLER",
  WAR = "WAR",
  WESTERN = "WESTERN",
  DOCUMENTARY = "DOCUMENTARY",
  SCI_FI = "Sci_fi",
}

/** Подписи для UI (русский); значения enum при отправке на API без изменений */
export const GenreLabels: Record<Genre, string> = {
  [Genre.ACTION]: "Боевик",
  [Genre.DRAMA]: "Драма",
  [Genre.COMEDY]: "Комедия",
  [Genre.DETECTIVE]: "Детектив",
  [Genre.FAMILY]: "Семейный",
  [Genre.FANTASY]: "Фэнтези",
  [Genre.HORROR]: "Ужасы",
  [Genre.MUSICAL]: "Мюзикл",
  [Genre.ROMANCE]: "Мелодрама",
  [Genre.THRILLER]: "Триллер",
  [Genre.WAR]: "Военный",
  [Genre.WESTERN]: "Вестерн",
  [Genre.DOCUMENTARY]: "Документальный",
  [Genre.SCI_FI]: "Научная фантастика",
};

export const GenreValues = Object.values(Genre);
