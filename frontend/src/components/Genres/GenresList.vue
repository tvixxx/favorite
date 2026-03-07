<script lang="ts" setup>
import {
  Genre,
  GenreLabels,
  GenreValues,
} from "@/components/Genres/constants/genres.constants";
import type { SelectProps } from "ant-design-vue";

const currentGenre = defineModel<Genre>();

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
    v-model:value="currentGenre"
    :allow-clear="true"
    :filter-option="filterOption"
    :options="genreOptions"
    :style="{ width: '100%' }"
    class="genre-select"
    placeholder="Выберите жанр"
    show-search
    size="large"
  />
</template>

<style lang="scss" scoped></style>
