<script setup lang="ts">
import type { LeaderboardSortBy, LeaderboardSortOrder } from "@/stores";
import type { SelectProps } from "ant-design-vue";

const props = defineProps<{
  sortBy: LeaderboardSortBy;
  sortOrder: LeaderboardSortOrder;
}>();

const emit = defineEmits<{
  "update:sortBy": [value: LeaderboardSortBy];
  "update:sortOrder": [value: LeaderboardSortOrder];
}>();

const sortByOptions: SelectProps["options"] = [
  {
    value: "totalScore",
    label: "По баллам (фильмы + досмотренные сериалы)",
  },
  { value: "registeredAt", label: "По дате регистрации" },
  { value: "films", label: "По количеству фильмов" },
  { value: "serialsTotal", label: "По сериалам в коллекции (всего)" },
  {
    value: "serialsCompleted",
    label: "По полностью просмотренным сериалам",
  },
];

const sortOrderOptions: SelectProps["options"] = [
  { value: "desc", label: "По убыванию" },
  { value: "asc", label: "По возрастанию" },
];

const onSortByChange = (value: LeaderboardSortBy) => {
  emit("update:sortBy", value);
};

const onSortOrderChange = (value: LeaderboardSortOrder) => {
  emit("update:sortOrder", value);
};
</script>

<template>
  <div class="filters-panel filters-shared leaderboard-filters-bar">
    <div class="filters-panel__main">
      <a-select
        :value="props.sortBy"
        :options="sortByOptions"
        placeholder="Сортировка"
        class="leaderboard-filters-bar__sort leaderboard-filters-bar__sort--wide"
        size="large"
        @update:value="onSortByChange"
      />
      <a-select
        :value="props.sortOrder"
        :options="sortOrderOptions"
        placeholder="Порядок"
        class="leaderboard-filters-bar__sort leaderboard-filters-bar__sort--narrow"
        size="large"
        @update:value="onSortOrderChange"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/media" as *;

.filters-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  margin-bottom: 0;

  &__main {
    display: flex;
    flex-direction: column;
    gap: 8px;

    @include mediaTablet {
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
  }
}

.leaderboard-filters-bar {
  width: 100%;
  max-width: var(--page-max-width, 1200px);

  &__sort {
    width: 100%;

    @include mediaTablet {
      &--wide {
        flex: 1 1 280px;
        max-width: min(100%, 520px);
        min-width: 220px;
      }

      &--narrow {
        flex: 0 0 auto;
        width: 200px;
        min-width: 180px;
      }
    }
  }
}
</style>
