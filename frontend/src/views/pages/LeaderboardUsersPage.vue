<script lang="ts" setup>
import { storeToRefs } from "pinia";
import { computed, onMounted } from "vue";
import RowsSkeleton from "@/components/Skeleton/RowsSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import LeaderboardRow from "@/components/Leaderboard/LeaderboardRow.vue";
import { avatarGradient } from "@/composable/useAvatarGradient";
import { useMainStore } from "@/state/state";
import { useLeaderboardStore } from "@/stores";
import { PLURAL, pluralize } from "@/utils";
import { useRouter } from "vue-router";

const router = useRouter();
const mainStore = useMainStore();
const leaderboardStore = useLeaderboardStore();
const { items, total, isLoading, isError, currentPage } =
  storeToRefs(leaderboardStore);

const showSkeleton = useMinLoading(() => isLoading.value);

const initial = (name: string): string => (name.trim()[0] ?? "?").toUpperCase();

// Эталон: одна короткая подпись, сериалы отдельной цифрой не выносятся
const collectionSummary = (row: { filmsCount: number }): string =>
  `${pluralize(row.filmsCount, PLURAL.movie)} в коллекции`;

const currentUserId = computed(() => mainStore.userData?.id ?? "");

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
      :actions="[
        {
          label: 'Оценить фильмы',
          icon: 'ph:star',
          kind: 'primary',
          onClick: () => router.push('/library/catalog'),
        },
      ]"
    />

    <template v-else>
      <div class="lb-list">
        <LeaderboardRow
          v-for="row in items"
          :key="row.userId"
          :rank="row.rank"
          :title="row.userId === currentUserId ? 'Вы' : row.displayName"
          :subtitle="collectionSummary(row)"
          :metric="row.totalScore"
          :highlighted="row.userId === currentUserId"
        >
          <template #media>
            <span
              class="lb-users__avatar"
              :style="{ background: avatarGradient(row.userId) }"
            >
              {{ initial(row.displayName) }}
            </span>
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
    font-weight: 500;
    color: #fff;
  }

  &__pagination {
    display: flex;
    justify-content: center;
    padding: 2rem 0 1rem;
  }
}

.lb-list {
  width: 100%;
  padding: 10px 8px;
  border-radius: var(--fv-radius-lg);
  background: var(--fv-color-bg-primary);
  box-shadow: var(--fv-shadow-card);
}
</style>
