<script lang="ts" setup>
import { storeToRefs } from "pinia";
import { onMounted } from "vue";
import LeaderboardFiltersBar from "@/components/Leaderboard/LeaderboardFiltersBar.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import {
  useLeaderboardStore,
  type LeaderboardSortBy,
  type LeaderboardSortOrder,
} from "@/stores";
import { formatDate } from "@/utils";

const leaderboardStore = useLeaderboardStore();
const { items, total, isLoading, isError, sortBy, sortOrder, currentPage } =
  storeToRefs(leaderboardStore);

const onSortByUpdate = (value: LeaderboardSortBy) => {
  void leaderboardStore.setSort(value, sortOrder.value);
};

const onSortOrderUpdate = (value: LeaderboardSortOrder) => {
  void leaderboardStore.setSort(sortBy.value, value);
};

const tierTagColor = (
  tier: string
): "default" | "success" | "processing" | "error" | "warning" => {
  switch (tier) {
    case "platinum":
      return "processing";
    case "gold":
      return "warning";
    case "silver":
      return "default";
    default:
      return "success";
  }
};

onMounted(() => {
  void leaderboardStore.fetchTopUsers();
});
</script>

<template>
  <div class="leaderboard-page">
    <div class="leaderboard-page__content">
      <LeaderboardFiltersBar
        :sort-by="sortBy"
        :sort-order="sortOrder"
        @update:sort-by="onSortByUpdate"
        @update:sort-order="onSortOrderUpdate"
      />

      <ListError
        v-if="isError"
        :is-error="isError"
        :repeat-fn="() => void leaderboardStore.fetchTopUsers()"
        repeat-text="Повторить"
      />

      <div v-else-if="isLoading" class="leaderboard-page__loading">
        <ListLoading
          size="large"
          loading-text="Загружаем рейтинг..."
          :center="true"
        />
      </div>

      <div v-else-if="!items.length" class="leaderboard-page__empty">
        <a-empty description="Пока нет пользователей с добавленными фильмами" />
      </div>

      <template v-else>
        <div class="leaderboard-page__grid">
          <a-card
            v-for="row in items"
            :key="row.userId"
            class="leaderboard-card"
            :class="{
              'leaderboard-card--gold': row.rank === 1,
              'leaderboard-card--silver': row.rank === 2,
              'leaderboard-card--bronze': row.rank === 3,
            }"
            :bordered="false"
          >
            <div class="leaderboard-card__rank">
              <span class="leaderboard-card__rank-num">#{{ row.rank }}</span>
            </div>
            <h3 class="leaderboard-card__name">{{ row.displayName }}</h3>
            <p class="leaderboard-card__meta">
              На сайте с {{ formatDate(row.registeredAt) }}
            </p>

            <a-descriptions
              class="leaderboard-card__stats"
              :column="1"
              size="small"
              bordered
            >
              <a-descriptions-item label="Фильмы (в зачёт)">
                {{ row.filmsCount }}
              </a-descriptions-item>
              <a-descriptions-item label="Сериалов в коллекции">
                {{ row.serialsTotal }}
              </a-descriptions-item>
              <a-descriptions-item label="Сериалов досмотрено">
                {{ row.serialsCompleted }}
              </a-descriptions-item>
              <a-descriptions-item label="Баллы">
                <strong>{{ row.totalScore }}</strong>
              </a-descriptions-item>
            </a-descriptions>

            <div v-if="row.badges.length" class="leaderboard-card__badges">
              <span class="leaderboard-card__badges-title">Бейджи</span>
              <div class="leaderboard-card__badges-list">
                <a-tooltip
                  v-for="b in row.badges"
                  :key="b.id"
                  :title="b.title"
                >
                  <a-tag :color="tierTagColor(b.tier)" class="leaderboard-card__badge">
                    <span class="leaderboard-card__badge-icon">{{ b.icon }}</span>
                    <span class="leaderboard-card__badge-text">{{ b.title }}</span>
                  </a-tag>
                </a-tooltip>
              </div>
            </div>
          </a-card>
        </div>

        <div v-if="total > leaderboardStore.pageSize" class="leaderboard-page__pagination">
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
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/layout" as *;

.leaderboard-page {
  width: 100%;

  &__content {
    @include pageContentContainer;
  }

  &__loading,
  &__empty {
    min-height: 40vh;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  &__grid {
    display: grid;
    width: 100%;
    max-width: var(--grid-max-width);
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
    margin-bottom: 2rem;
  }

  &__pagination {
    display: flex;
    justify-content: center;
    padding: 2rem 0 1rem;
  }
}

.leaderboard-card {
  border-radius: var(--radius-lg) !important;
  background: var(--bg-primary) !important;
  box-shadow: var(--shadow-card);
  border: 1px solid color-mix(in srgb, var(--border-color) 55%, transparent) !important;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-elevated);
  }

  &--gold {
    border-color: color-mix(in srgb, #eab308 55%, var(--border-color)) !important;
    box-shadow: var(--shadow-card), 0 0 0 1px color-mix(in srgb, #eab308 25%, transparent);
  }

  &--silver {
    border-color: color-mix(in srgb, #94a3b8 55%, var(--border-color)) !important;
  }

  &--bronze {
    border-color: color-mix(in srgb, #d97706 45%, var(--border-color)) !important;
  }

  :deep(.ant-card-body) {
    padding: 1.25rem 1.25rem 1.5rem;
  }

  &__rank {
    margin-bottom: 0.5rem;
  }

  &__rank-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.95rem;
    letter-spacing: 0.02em;
    color: var(--ant-color-primary);
    background: color-mix(in srgb, var(--ant-color-primary) 12%, transparent);
    padding: 0.25rem 0.65rem;
    border-radius: var(--radius-sm);
  }

  &__name {
    margin: 0 0 0.35rem;
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1.25;
  }

  &__meta {
    margin: 0 0 1rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  &__stats {
    margin-bottom: 1rem;

    :deep(.ant-descriptions-item-label) {
      font-weight: 600;
      color: var(--text-secondary);
      width: 55%;
    }

    :deep(.ant-descriptions-item-content) {
      color: var(--text-primary);
    }
  }

  &__badges-title {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  &__badges-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  &__badge {
    margin: 0 !important;
    display: inline-flex !important;
    align-items: center;
    gap: 0.25rem;
    max-width: 100%;
    border-radius: var(--radius-sm) !important;
  }

  &__badge-icon {
    flex-shrink: 0;
    line-height: 1;
  }

  &__badge-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }
}
</style>
