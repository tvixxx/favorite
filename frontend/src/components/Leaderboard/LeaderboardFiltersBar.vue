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
  <div class="leaderboard-filters-bar">
    <div class="leaderboard-filters-bar__field">
      <span class="leaderboard-filters-bar__label">Сортировка</span>
      <a-select
        :value="props.sortBy"
        :options="sortByOptions"
        class="leaderboard-filters-bar__select"
        size="large"
        @update:value="onSortByChange"
      />
    </div>
    <div class="leaderboard-filters-bar__field">
      <span class="leaderboard-filters-bar__label">Порядок</span>
      <a-select
        :value="props.sortOrder"
        :options="sortOrderOptions"
        class="leaderboard-filters-bar__select leaderboard-filters-bar__select--narrow"
        size="large"
        @update:value="onSortOrderChange"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/media" as *;

.leaderboard-filters-bar {
  margin-top: 2rem;
  margin-bottom: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  width: 100%;
  max-width: var(--page-max-width);
  justify-content: center;
  align-items: flex-end;

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: min(100%, 320px);
  }

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__select {
    width: min(100%, 420px);

    &--narrow {
      width: min(100%, 200px);
    }
  }

  @include mediaMax(480px) {
    flex-direction: column;
    align-items: stretch;
    margin-top: 1.5rem;

    &__select,
    &__select--narrow {
      width: 100%;
    }
  }
}
</style>
