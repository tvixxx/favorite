<script setup lang="ts">
import {
  Genre,
  GenreLabels,
  GenreValues,
} from "@/components/Genres/constants/genres.constants";
import type { SelectProps } from "ant-design-vue";

const selectedGenre = defineModel<Genre>();

const genreOptions: SelectProps["options"] = GenreValues.map((genre) => ({
  label: GenreLabels[genre],
  value: genre,
}));

const filterOption = (input: string, option: any) => {
  return option.label.toLowerCase().includes(input.toLowerCase());
};
</script>

<template>
  <a-select
    v-model:value="selectedGenre"
    :allow-clear="true"
    :filter-option="filterOption"
    :options="genreOptions"
    class="genre-filter"
    placeholder="Все жанры"
    show-search
    size="large"
  />
</template>

<style lang="scss" scoped>
.genre-filter {
  min-width: 180px;
}
</style>
