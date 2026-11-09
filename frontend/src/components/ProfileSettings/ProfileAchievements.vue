<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import BadgesList from "@/components/Badges/BadgesList.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import type { Badge } from "@/stores/badges";

const props = defineProps<{
  unlocked: Badge[];
  locked: Badge[];
  loading?: boolean;
}>();
const pageSize = 3;
const view = shallowRef<"unlocked" | "locked">("unlocked");
const page = shallowRef(1);
const badges = computed(() => props[view.value]);
const pageCount = computed(() => Math.ceil(badges.value.length / pageSize));
const visibleBadges = computed(() =>
  badges.value.slice((page.value - 1) * pageSize, page.value * pageSize)
);

watch(pageCount, (count) => {
  page.value = Math.min(page.value, Math.max(1, count));
});

const selectView = (value: "unlocked" | "locked"): void => {
  if (view.value !== value) {
    view.value = value;
    page.value = 1;
  }
};
</script>

<template>
  <div class="profile-achievements" :aria-busy="loading || undefined">
    <header class="profile-achievements__heading">
      <div>
        <slot />
        <p v-if="!loading">
          {{ unlocked.length }} из
          {{ unlocked.length + locked.length }} получено
        </p>
        <p v-else aria-hidden="true">
          <SkeletonBar width="90px" height="10px" radius="5px" />
        </p>
      </div>
      <div
        v-if="loading"
        class="profile-achievements__controls"
        aria-hidden="true"
      >
        <SkeletonBar
          width="125px"
          height="44px"
          radius="var(--fv-radius-control)"
        />
        <SkeletonBar
          width="122px"
          height="44px"
          radius="var(--fv-radius-control)"
        />
      </div>
      <div
        v-else
        class="profile-achievements__controls"
        role="group"
        aria-label="Показать достижения"
      >
        <button
          type="button"
          aria-label="Открытые"
          :aria-pressed="view === 'unlocked'"
          @click="selectView('unlocked')"
        >
          Открытые <span aria-hidden="true">· {{ unlocked.length }}</span>
        </button>
        <button
          type="button"
          aria-label="Закрытые"
          :aria-pressed="view === 'locked'"
          @click="selectView('locked')"
        >
          Закрытые <span aria-hidden="true">· {{ locked.length }}</span>
        </button>
      </div>
    </header>
    <div
      v-if="loading"
      class="profile-achievements__list profile-achievements__placeholders"
      aria-hidden="true"
    >
      <div
        v-for="row in pageSize"
        :key="row"
        class="profile-achievements__placeholder"
      >
        <SkeletonBar
          width="34px"
          height="34px"
          radius="var(--fv-radius-control)"
        />
        <div>
          <SkeletonBar width="64%" height="14px" radius="5px" />
          <SkeletonBar width="86%" height="10px" radius="5px" />
          <SkeletonBar width="35%" height="9px" radius="5px" />
        </div>
      </div>
    </div>
    <BadgesList
      v-else
      class="profile-achievements__list"
      role="region"
      :aria-label="
        view === 'locked' ? 'Закрытые достижения' : 'Открытые достижения'
      "
      :badges="visibleBadges"
      :show-locked="view === 'locked'"
    />
    <div
      v-if="!loading && pageCount > 1"
      class="profile-achievements__controls profile-achievements__pager"
    >
      <button
        type="button"
        aria-label="Предыдущая страница достижений"
        :disabled="page === 1"
        @click="page--"
      >
        <BaseIcon
          name="ph:caret-left"
          :width="18"
          :height="18"
          aria-hidden="true"
        />
      </button>
      <span aria-live="polite">{{ page }} из {{ pageCount }}</span>
      <button
        type="button"
        aria-label="Следующая страница достижений"
        :disabled="page === pageCount"
        @click="page++"
      >
        <BaseIcon
          name="ph:caret-right"
          :width="18"
          :height="18"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.profile-achievements {
  display: grid;
  gap: 12px;
  --profile-award-min-height: 94px;

  &__heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;

    p {
      margin: 4px 0 0;
      color: var(--fv-color-text-secondary);
      font-size: 0.8125rem;
      min-height: 20px;
      line-height: 20px;
      display: flex;
      align-items: center;
    }
  }

  &__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;

    button {
      min-width: 44px;
      min-height: 44px;
      padding: 6px 10px;
      border: 1px solid var(--fv-color-border);
      border-radius: var(--fv-radius-control);
      background: var(--fv-color-bg-primary);
      color: var(--fv-color-text-primary);
      font: inherit;
      font-weight: 500;
      cursor: pointer;

      &[aria-pressed="true"] {
        border-color: var(--fv-color-accent);
        background: color-mix(
          in srgb,
          var(--fv-color-accent) 13%,
          var(--fv-color-bg-primary)
        );
        font-weight: 700;
      }

      &:focus-visible {
        outline: 2px solid var(--fv-color-accent);
        outline-offset: 2px;
      }

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
    }
  }

  &__list {
    min-width: 0;

    :deep(.badge-item) {
      min-height: var(--profile-award-min-height);
    }

    @include mediaTablet {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  &__placeholders {
    display: grid;
    gap: 10px;
  }

  &__placeholder {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    align-items: center;
    gap: 11px;
    min-height: var(--profile-award-min-height);
    padding: 10px;
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-secondary);

    > div {
      display: grid;
      gap: 5px;
    }
  }

  &__pager {
    justify-content: flex-end;
    color: var(--fv-color-text-secondary);

    button {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      padding: 0;
      line-height: 1;
    }

    svg {
      display: block;
    }
  }
}
</style>
