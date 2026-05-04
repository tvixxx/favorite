<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useDebounceFn } from "@vueuse/core";
import { RouterLink } from "vue-router";

import AppBackButton from "@/components/AppBackButton/AppBackButton.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import { useActorsStore } from "@/stores";

const actorsStore = useActorsStore();

const searchInput = ref(actorsStore.actorsSearchQ);

const runLoad = async () => {
  try {
    await actorsStore.fetchActorsPage({
      q: searchInput.value,
      page: actorsStore.actorsPageCurrent,
      pageSize: actorsStore.actorsPageSize,
    });
  } catch {
    message.error("Не удалось загрузить список актёров");
  }
};

const debouncedSearch = useDebounceFn(async () => {
  actorsStore.actorsPageCurrent = 1;
  await runLoad();
}, 350);

watch(searchInput, () => {
  void debouncedSearch();
});

onMounted(async () => {
  actorsStore.actorsPageCurrent = 1;
  await runLoad();
});

const onPageChange = (page: number) => {
  actorsStore.actorsPageCurrent = page;
  void runLoad();
};

const onPageSizeChange = (_current: number, size: number) => {
  actorsStore.actorsPageSize = size;
  actorsStore.actorsPageCurrent = 1;
  void runLoad();
};

const emptyDescription = computed(() => {
  if (actorsStore.actorsSearchQ.trim()) {
    return "Никого не нашли — попробуйте другой запрос";
  }

  return "Пока нет ни одного актёра в каталоге.";
});

const showEmptyBlock = computed(
  () =>
    !actorsStore.isActorsLoading &&
    actorsStore.actorsPageItems.length === 0,
);
</script>

<template>
  <div class="actors-page">
    <div class="actors-page__content">
      <div class="actors-page__toolbar">
        <AppBackButton
          class="actors-page__back"
          label="К коллекции"
          mode="replace"
          :fallback="{ path: '/library/collection' }"
        />
        <a-input
          v-model:value="searchInput"
          class="actors-page__search"
          size="large"
          allow-clear
          placeholder="Поиск по имени актёра…"
          aria-label="Поиск по имени актёра"
        >
          <template #prefix>
            <BaseIcon name="mdi:magnify" :width="18" :height="18" />
          </template>
        </a-input>
      </div>

      <ListError
        v-if="actorsStore.isActorsError"
        :is-error="actorsStore.isActorsError"
        :repeat-fn="runLoad"
        repeat-text="Повторить"
      />

      <ListLoading
        v-else-if="actorsStore.isActorsLoading && !actorsStore.actorsPageItems.length"
        :center="true"
        loading-text="Загружаем актёров…"
        size="large"
      />

      <div v-else-if="showEmptyBlock" class="actors-page__empty">
        <p>{{ emptyDescription }}</p>
      </div>

      <template v-else>
        <ul class="actors-page__list" aria-label="Список актёров">
          <li v-for="a in actorsStore.actorsPageItems" :key="a.id">
            <RouterLink class="actors-page__link" :to="`/library/actors/${a.id}`">
              <BaseIcon class="actors-page__icon" name="mdi:account" :width="22" :height="22" />
              <span>{{ a.name }}</span>
              <BaseIcon
                class="actors-page__chevron"
                name="mdi:chevron-right"
                :width="20"
                :height="20"
              />
            </RouterLink>
          </li>
        </ul>

        <div
          v-if="actorsStore.actorsPageTotal > actorsStore.actorsPageSize"
          class="actors-page__pagination"
        >
          <a-pagination
            :current="actorsStore.actorsPageCurrent"
            :page-size="actorsStore.actorsPageSize"
            :total="actorsStore.actorsPageTotal"
            show-size-changer
            :page-size-options="['10', '20', '50', '100']"
            @change="onPageChange"
            @show-size-change="onPageSizeChange"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/layout" as *;
@use "@/styles/media" as *;

.actors-page {
  width: 100%;

  &__content {
    @include pageContentContainer;
    align-items: stretch;
  }

  &__toolbar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    width: 100%;
    max-width: var(--grid-max-width);
    margin-bottom: 0.5rem;

    @include mediaTablet {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 1rem;
    }
  }

  &__back {
    :deep(.app-back-btn) {
      margin: 0;
    }
  }

  &__search {
    flex: 1;
    min-width: min(100%, 280px);
    max-width: 520px;

    @include mediaTablet {
      margin-left: auto;
    }
  }

  &__empty {
    min-height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    text-align: center;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: var(--grid-max-width);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__pagination {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
    padding-bottom: 1rem;
  }

  &__link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: var(--radius-md);
    text-decoration: none;
    color: var(--text-primary);
    font-weight: 600;
    background: var(--bg-primary);
    border: 1px solid color-mix(in srgb, var(--border-color) 65%, transparent);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      color 0.2s ease;

    &:hover {
      border-color: color-mix(
        in srgb,
        var(--ant-color-primary) 35%,
        var(--border-color)
      );
      box-shadow: 0 4px 16px color-mix(in srgb, #000 6%, transparent);
    }
  }

  &__icon {
    flex-shrink: 0;
    color: var(--ant-color-primary);
    opacity: 0.9;
  }

  &__chevron {
    margin-left: auto;
    flex-shrink: 0;
    color: var(--text-secondary);
    opacity: 0.8;
  }
}
</style>
