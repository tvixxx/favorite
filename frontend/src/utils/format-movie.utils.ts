import { countriesLabelsRu } from "@/constants/countries/production-countries";
import { formatYear } from "./date.utils";

export function formatAverageRating(
  value: number | null | undefined
): string | null {
  if (value == null || Number.isNaN(Number(value))) {
    return null;
  }

  return Number(value).toFixed(1);
}

interface MovieCardLike {
  title: string;
  isSerial?: boolean;
  publishDate?: Date | string | null;
  countryCodes?: string[] | null;
}

/** Заголовок карточки: название + пометка «(сериал)» */
export function movieCardTitle(movie: MovieCardLike): string {
  return `${movie.title}${movie.isSerial ? " (сериал)" : ""}`;
}

/** Компактная мета-строка карточки: год · страны */
export function movieCardMeta(movie: MovieCardLike): string {
  const parts: string[] = [];

  if (movie.publishDate) {
    parts.push(formatYear(movie.publishDate));
  }

  if (movie.countryCodes?.length) {
    parts.push(countriesLabelsRu(movie.countryCodes));
  }

  return parts.join(" · ");
}
