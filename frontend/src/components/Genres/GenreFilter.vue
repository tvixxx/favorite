<script setup lang="ts">
import {
  Genre,
  GenreLabels,
  GenreValues,
} from "@/components/Genres/constants/genres.constants";
import type { SelectProps } from "ant-design-vue";

const selectedGenres = defineModel<Genre[]>({ default: () => [] });

const genreOptions: SelectProps["options"] = GenreValues.map((genre) => ({
  label: GenreLabels[genre],
  value: genre,
}));

const filterOption = (input: string, option: { label?: string }) =>
  (option.label ?? "").toLowerCase().includes(input.toLowerCase());
</script>

<template>
  <a-select
    v-model:value="selectedGenres"
    mode="multiple"
    :allow-clear="true"
    :filter-option="filterOption"
    :max-tag-count="2"
    :options="genreOptions"
    class="genre-filter"
    placeholder="Жанры"
    show-search
    size="large"
  />
</template>

<style lang="scss" scoped>
.genre-filter {
  min-width: 180px;
}
</style>
