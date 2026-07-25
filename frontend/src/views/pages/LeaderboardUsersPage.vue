<script lang="ts" setup>
import { storeToRefs } from "pinia";
import { onMounted } from "vue";
import RowsSkeleton from "@/components/Skeleton/RowsSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import LeaderboardRow from "@/components/Leaderboard/LeaderboardRow.vue";
import { useLeaderboardStore } from "@/stores";

const leaderboardStore = useLeaderboardStore();
const { items, total, isLoading, isError, currentPage } =
  storeToRefs(leaderboardStore);

const showSkeleton = useMinLoading(() => isLoading.value);

const initial = (name: string): string => (name.trim()[0] ?? "?").toUpperCase();

const collectionSummary = (row: {
  filmsCount: number;
  serialsTotal: number;
}): string => {
  const parts = [`${row.filmsCount} фильмов`];

  if (row.serialsTotal) {
    parts.push(`${row.serialsTotal} сериалов`);
  }

  return parts.join(" · ");
};

onMounted(() => {
  void leaderboardStore.fetchTopUsers();
});
</script>

<template>
  <div class="lb-users">
    <StateBlock
      v-if="isError"
      v-bind="STATE_PRESETS.leaderboardError"
      :actions="[
        {
          label: 'Повторить',
          icon: 'ph:arrow-clockwise',
          kind: 'primary',
          onClick: () => void leaderboardStore.fetchTopUsers(),
        },
      ]"
    />

    <RowsSkeleton v-else-if="showSkeleton" :count="8" />

    <StateBlock
      v-else-if="!items.length"
      v-bind="STATE_PRESETS.leaderboardEmpty"
    />

    <template v-else>
      <div class="lb-list">
        <LeaderboardRow
          v-for="row in items"
          :key="row.userId"
          :rank="row.rank"
          :title="row.displayName"
          :subtitle="collectionSummary(row)"
          :metric="row.totalScore"
        >
          <template #media>
            <span class="lb-users__avatar">{{ initial(row.displayName) }}</span>
          </template>
        </LeaderboardRow>
      </div>

      <div
        v-if="total > leaderboardStore.pageSize"
        class="lb-users__pagination"
      >
        <a-pagination
          :current="currentPage"
          :page-size="leaderboardStore.pageSize"
          :total="total"
          show-less-items
          @change="(p: number) => void leaderboardStore.setPage(p)"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.lb-users {
  width: 100%;

  &__state {
    min-height: 40vh;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  &__avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #3a6ff0, #1b2a6b);
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
