<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, ref, watch } from "vue";
import CatalogMoviePreviewModal from "@/components/Catalog/CatalogMoviePreviewModal.vue";
import RowsSkeleton from "@/components/Skeleton/RowsSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import LeaderboardRow from "@/components/Leaderboard/LeaderboardRow.vue";
import { useLeaderboardMoviesStore } from "@/stores";
import { formatYear } from "@/utils";

const store = useLeaderboardMoviesStore();
const { items, total, isLoading, isError, currentPage } = storeToRefs(store);

const showSkeleton = useMinLoading(
  () => isLoading.value && !items.value.length,
);

const previewOpen = ref(false);
const previewMovieId = ref<string | null>(null);

function openPreview(movieId: string): void {
  previewMovieId.value = movieId;
  previewOpen.value = true;
}

watch(previewOpen, (open) => {
  if (!open) {
    previewMovieId.value = null;
  }
});

const rowSubtitle = (row: {
  publishDate: string | null;
  isSerial: boolean;
}): string => {
  const parts: string[] = [];

  if (row.publishDate) {
    parts.push(formatYear(row.publishDate));
  }

  parts.push(row.isSerial ? "сериал" : "фильм");

  return parts.join(" · ");
};

const rowRate = (row: {
  avgPersonalRate: number | null;
  ratingsCount: number;
}): string => {
  if (row.ratingsCount === 0 || row.avgPersonalRate === null) {
    return "—";
  }

  return row.avgPersonalRate.toFixed(1);
};

onMounted(() => {
  void store.fetchTopMovies();
});
</script>

<template>
  <div class="lb-movies">
    <StateBlock
      v-if="isError"
      v-bind="STATE_PRESETS.leaderboardError"
      :actions="[
        {
          label: 'Повторить',
          icon: 'ph:arrow-clockwise',
          kind: 'primary',
          onClick: () => void store.fetchTopMovies(),
        },
      ]"
    />

    <RowsSkeleton v-else-if="showSkeleton" :count="8" />

    <StateBlock
      v-else-if="!isLoading && !items.length"
      v-bind="STATE_PRESETS.leaderboardEmpty"
    />

    <template v-else>
      <a-spin :spinning="isLoading" size="large" tip="Обновляем список...">
        <div class="lb-list">
          <LeaderboardRow
            v-for="row in items"
            :key="row.movieId"
            :rank="row.rank"
            :title="row.title"
            :subtitle="rowSubtitle(row)"
            :metric="rowRate(row)"
            clickable
            @open="openPreview(row.movieId)"
          >
            <template #media>
              <span class="lb-movies__poster">
                <img
                  v-if="row.posterUrl"
                  :src="row.posterUrl"
                  :alt="row.title"
                  loading="lazy"
                />
              </span>
            </template>
          </LeaderboardRow>
        </div>

        <div
          v-if="total > store.pageSize"
          class="lb-movies__pagination"
        >
          <a-pagination
            :current="currentPage"
            :page-size="store.pageSize"
            :total="total"
            show-less-items
            @change="(p: number) => void store.setPage(p)"
          />
        </div>
      </a-spin>
    </template>

    <CatalogMoviePreviewModal v-model="previewOpen" :movie-id="previewMovieId" />
  </div>
</template>

<style lang="scss" scoped>
.lb-movies {
  width: 100%;

  &__state {
    min-height: 40vh;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  &__poster {
    width: 40px;
    aspect-ratio: 2 / 3;
    border-radius: 8px;
    overflow: hidden;
    background: var(--fv-color-bg-secondary);
    display: block;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  &__pagination {
    display: flex;
    justify-content: center;
    padding: 2rem 0 1rem;
  }
}

.lb-list {
  width: 100%;
  padding: 8px;
  border-radius: var(--fv-radius-lg);
  background: var(--fv-color-bg-primary);
  box-shadow: var(--fv-shadow-card);
  border: 1px solid color-mix(in srgb, var(--fv-color-border) 55%, transparent);
}
</style>
