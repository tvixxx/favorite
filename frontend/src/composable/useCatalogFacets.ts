import { computed } from "vue";
import dayjs, { type Dayjs } from "dayjs";
import {
  GenreLabels,
  type Genre,
} from "@/components/Genres/constants/genres.constants";
import type { FilterTag } from "@/components/MoviesFiltersPanel/FiltersActiveTags.vue";
import { PRODUCTION_COUNTRIES } from "@/constants/countries/production-countries";
import type { MoviesFilters } from "@/stores/movies/types";
import { contentKindOptions } from "@/utils/content-kind";
import { releaseDateInput, releaseMonthBound } from "@/utils/releaseDate";

type CatalogFacets = Pick<
  MoviesFilters,
  | "contentKind"
  | "isSerial"
  | "genres"
  | "countryCodes"
  | "publishDateFrom"
  | "publishDateTo"
>;

export const clearedCatalogFacets: Readonly<CatalogFacets> = {
  contentKind: undefined,
  isSerial: undefined,
  genres: undefined,
  countryCodes: undefined,
  publishDateFrom: undefined,
  publishDateTo: undefined,
};

export function useCatalogFacets(
  filters: () => CatalogFacets,
  update: (patch: CatalogFacets) => void
) {
  const selectedGenres = computed<Genre[]>({
    get: () => filters().genres ?? [],
    set: (genres) => update({ genres: genres.length ? genres : undefined }),
  });
  const selectedCountries = computed<string[]>({
    get: () => filters().countryCodes ?? [],
    set: (countryCodes) =>
      update({ countryCodes: countryCodes.length ? countryCodes : undefined }),
  });
  const publishDateRange = computed<[Dayjs, Dayjs] | null>({
    get: (): [Dayjs, Dayjs] | null => {
      const { publishDateFrom, publishDateTo } = filters();

      return publishDateFrom && publishDateTo
        ? [releaseDateInput(publishDateFrom), releaseDateInput(publishDateTo)]
        : null;
    },
    set: (range) =>
      update({
        publishDateFrom: range?.[0]
          ? releaseMonthBound(range[0], "from")
          : undefined,
        publishDateTo: range?.[1]
          ? releaseMonthBound(range[1], "to")
          : undefined,
      }),
  });

  const tags = computed<FilterTag[]>(() => {
    const { contentKind, isSerial } = filters();
    const items = selectedGenres.value.map((genre) => ({
      key: `genre:${genre}`,
      label: GenreLabels[genre],
    }));

    for (const code of selectedCountries.value) {
      items.push({
        key: `country:${code}`,
        label:
          PRODUCTION_COUNTRIES.find((country) => country.code === code)
            ?.label ?? code,
      });
    }

    const category = contentKindOptions.find(
      (option) => option.value === contentKind
    );

    if (category) items.push({ key: "contentKind", label: category.label });
    if (isSerial !== undefined)
      items.push({
        key: "format",
        label: isSerial ? "Сериалы и выпуски" : "Фильмы",
      });

    const [from, to] = publishDateRange.value ?? [];

    if (from && to)
      items.push({
        key: "date",
        label: `${dayjs(from).format("MM.YYYY")} — ${dayjs(to).format(
          "MM.YYYY"
        )}`,
      });

    return items;
  });
  const count = computed(
    () => new Set(tags.value.map((tag) => tag.key.split(":")[0])).size
  );

  function removeTag(key: string): void {
    const [type, value] = key.split(":");

    switch (type) {
      case "contentKind":
        update({ contentKind: undefined });
        break;
      case "format":
        update({ isSerial: undefined });
        break;
      case "genre":
        selectedGenres.value = selectedGenres.value.filter(
          (genre) => genre !== value
        );

        break;
      case "country":
        selectedCountries.value = selectedCountries.value.filter(
          (country) => country !== value
        );

        break;
      case "date":
        publishDateRange.value = null;
    }
  }

  return {
    selectedGenres,
    selectedCountries,
    publishDateRange,
    tags,
    count,
    removeTag,
  };
}
