<script setup lang="ts">
import MoviesFiltersShared from "@/components/MoviesFiltersPanel/MoviesFiltersShared.vue";
import { useMoviesStore } from "@/stores";
import type { MoviesFilters } from "@/stores/movies/types";

const props = defineProps<{
  lockedActorIds?: string[];
}>();

const moviesStore = useMoviesStore();

async function runFetch() {
  const q = moviesStore.searchQuery.trim();

  if (q) {
    await moviesStore.findMovie(q);
  } else {
    await moviesStore.fetchMovies();
  }
}

function mergeFilters(f: MoviesFilters): MoviesFilters {
  const locked = props.lockedActorIds;
  if (locked?.length) {
    return { ...f, actorIds: locked };
  }

  return f;
}

function onMoviesFilters(f: MoviesFilters) {
  moviesStore.setFilters(mergeFilters(f));
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
  <div data-tour="catalog-filters">
    <MoviesFiltersShared
      :search-handler="onSearch"
      @update:movies-filters="onMoviesFilters"
      @cleared="onCleared"
    />
  </div>
</template>
