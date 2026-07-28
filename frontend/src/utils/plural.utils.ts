/** Формы слова для русской плюрализации: [1 фильм, 2 фильма, 5 фильмов] */
export type PluralForms = readonly [string, string, string];

export const PLURAL = {
  title: ["тайтл", "тайтла", "тайтлов"],
  movie: ["фильм", "фильма", "фильмов"],
  serial: ["сериал", "сериала", "сериалов"],
  season: ["сезон", "сезона", "сезонов"],
  episode: ["серия", "серии", "серий"],
  review: ["отзыв", "отзыва", "отзывов"],
  point: ["балл", "балла", "баллов"],
  friend: ["друг", "друга", "друзей"],
  participant: ["участник", "участника", "участников"],
} as const satisfies Record<string, PluralForms>;

/** Подбирает форму слова по числу: 1 фильм · 2 фильма · 5 фильмов · 11 фильмов */
export function pluralForm(count: number, forms: PluralForms): string {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return forms[0];
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return forms[1];
  }

  return forms[2];
}

/** Число вместе со словом в нужной форме: «2 фильма» */
export function pluralize(count: number, forms: PluralForms): string {
  return `${count} ${pluralForm(count, forms)}`;
}
