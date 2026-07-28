<script setup lang="ts">
import { computed } from "vue";

import MultiSelectField from "@/components/MoviesFiltersPanel/MultiSelectField.vue";
import {
  type Genre,
  GenreLabels,
  GenreValues,
} from "@/components/Genres/constants/genres.constants";

const selectedGenres = defineModel<Genre[]>({ default: () => [] });

const options = GenreValues.map((genre) => ({
  value: genre as string,
  label: GenreLabels[genre],
}));

// Поле работает со строками, наружу отдаём типизированные жанры
const selected = computed<string[]>({
  get: () => selectedGenres.value,
  set: (value) => {
    selectedGenres.value = value as Genre[];
  },
});
</script>

<template>
  <MultiSelectField
    v-model="selected"
    :options="options"
    label="Жанры"
    placeholder="Добавить жанр…"
  />
</template>
