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

export const GenreLabels: Record<Genre, string> = {
  [Genre.ACTION]: "Action",
  [Genre.DRAMA]: "Drama",
  [Genre.COMEDY]: "Comedy",
  [Genre.DETECTIVE]: "Detective",
  [Genre.FAMILY]: "Family",
  [Genre.FANTASY]: "Fantasy",
  [Genre.HORROR]: "Horror",
  [Genre.MUSICAL]: "Musical",
  [Genre.ROMANCE]: "Romance",
  [Genre.THRILLER]: "Thriller",
  [Genre.WAR]: "War",
  [Genre.WESTERN]: "Western",
  [Genre.DOCUMENTARY]: "Documentary",
  [Genre.SCI_FI]: "Sci-Fi",
};

export const GenreValues = Object.values(Genre);
