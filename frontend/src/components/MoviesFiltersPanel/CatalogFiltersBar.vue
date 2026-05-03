<script setup lang="ts">
import MoviesFiltersShared from "@/components/MoviesFiltersPanel/MoviesFiltersShared.vue";
import { useMoviesStore } from "@/stores";
import type { MoviesFilters } from "@/stores/movies/types";

const moviesStore = useMoviesStore();

async function runFetch() {
  const q = moviesStore.searchQuery.trim();

  if (q) {
    await moviesStore.findMovie(q);
  } else {
    await moviesStore.fetchMovies();
  }
}

function onMoviesFilters(f: MoviesFilters) {
  moviesStore.setFilters(f);
  moviesStore.setCurrentPage(1);

  runFetch();
}

function onCleared() {
  moviesStore.clearSearch();
  moviesStore.setCurrentPage(1);
}

async function onSearch(query: string) {
  moviesStore.setCurrentPage(1);
  await moviesStore.findMovie(query);
}
</script>

<template>
  <MoviesFiltersShared
    :search-handler="onSearch"
    @update:movies-filters="onMoviesFilters"
    @cleared="onCleared"
  />
</template>
