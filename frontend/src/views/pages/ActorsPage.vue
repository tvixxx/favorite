<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { RouterLink } from "vue-router";

import PosterGridSkeleton from "@/components/Skeleton/PosterGridSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import StateBlock, {
  type StateAction,
} from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import { useActorsStore } from "@/stores";
import { useMainStore } from "@/state/state";
import type { Actor } from "@/stores/actors/actorsStore";
import ActorPhotoEditor from "@/components/ImagePicker/ActorPhotoEditor.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const actorsStore = useActorsStore();
const main = useMainStore();
const photoOpen = ref(false);
const editingActor = ref<Actor | null>(null);
const imageErrors = ref(new Set<string>());
const canEditPhoto = (actor: Actor): boolean =>
  main.userData?.role === "ADMIN" ||
  (!!actor.createdById && actor.createdById === main.userData?.id);

function editPhoto(actor: Actor): void {
  editingActor.value = actor;
  photoOpen.value = true;
}

watch(photoOpen, (open) => {
  if (!open) {
    editingActor.value = null;
  }
});
watch(
  () => actorsStore.actorsPageItems,
  () => {
    imageErrors.value = new Set();
  }
);

const runLoad = async (): Promise<void> => {
  try {
    await actorsStore.fetchActorsPage({
      q: actorsStore.actorsSearchQ,
      page: actorsStore.actorsPageCurrent,
      pageSize: actorsStore.actorsPageSize,
    });
  } catch {
    message.error("Не удалось загрузить список актёров");
  }
};

// Поиск живёт в шапке (LibraryLayout) и пишет в actorsStore.actorsSearchQ — реагируем здесь
let searchTimer: ReturnType<typeof setTimeout> | undefined;

onBeforeUnmount(() => clearTimeout(searchTimer));

watch(
  () => actorsStore.actorsSearchQ,
  () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      actorsStore.actorsPageCurrent = 1;
      void runLoad();
    }, 350);
  }
);

onMounted(async () => {
  actorsStore.actorsPageCurrent = 1;
  await runLoad();
});

const onPageChange = (page: number): void => {
  actorsStore.actorsPageCurrent = page;
  void runLoad();
};

const onPageSizeChange = (_current: number, size: number): void => {
  actorsStore.actorsPageSize = size;
  actorsStore.actorsPageCurrent = 1;
  void runLoad();
};

const showSkeleton = useMinLoading(
  () => actorsStore.isActorsLoading && !actorsStore.actorsPageItems.length
);

const actorsEmptyState = computed(() => {
  if (actorsStore.actorsSearchQ.trim()) {
    return {
      variant: "empty" as const,
      icon: "ph:magnifying-glass",
      title: "Никого не нашли",
      description: "Попробуйте другой запрос.",
      actions: [
        {
          label: "Сбросить поиск",
          icon: "ph:arrow-counter-clockwise",
          kind: "secondary",
          onClick: () => {
            actorsStore.actorsSearchQ = "";
          },
        },
      ] as StateAction[],
    };
  }

  return {
    ...STATE_PRESETS.actorsEmpty,
    description:
      "Актёры появляются, когда вы добавляете фильмы в свою коллекцию.",
    actions: [] as StateAction[],
  };
});

const showEmptyBlock = computed(
  () => !actorsStore.isActorsLoading && actorsStore.actorsPageItems.length === 0
);

const initial = (name: string): string => (name.trim()[0] ?? "?").toUpperCase();

// Детерминированный градиент аватара по id (разнообразие как в эталоне)
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #3a6ff0, #1b2a6b)",
  "linear-gradient(135deg, #e0398a, #7b1fa2)",
  "linear-gradient(135deg, #26cd58, #0e7a3a)",
  "linear-gradient(135deg, #f95721, #b23a0e)",
  "linear-gradient(135deg, #8b5cf6, #4c1d95)",
  "linear-gradient(135deg, #f5a623, #b9770a)",
];

const gradientFor = (id: string): string => {
  let hash = 0;

  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  }

  return AVATAR_GRADIENTS[hash];
};
</script>

<template>
  <div class="actors-page">
    <div class="actors-page__content">
      <StateBlock
        v-if="actorsStore.isActorsError"
        v-bind="STATE_PRESETS.actorsError"
        :actions="[
          {
            label: 'Повторить',
            icon: 'ph:arrow-clockwise',
            kind: 'primary',
            onClick: runLoad,
          },
        ]"
      />

      <PosterGridSkeleton
        v-else-if="showSkeleton"
        :count="12"
        variant="avatar"
        :min-width="160"
      />

      <StateBlock v-else-if="showEmptyBlock" v-bind="actorsEmptyState" />

      <template v-else>
        <div class="actors-grid">
          <div
            v-for="a in actorsStore.actorsPageItems"
            :key="a.id"
            class="actor-card"
          >
            <RouterLink
              class="actor-card__link"
              :to="`/library/actors/${a.id}`"
            >
              <span
                class="actor-card__avatar"
                :style="{ background: gradientFor(a.id) }"
                aria-hidden="true"
              >
                <img
                  v-if="a.imageUrl && !imageErrors.has(a.id)"
                  :src="a.imageThumbnailUrl || a.imageUrl"
                  alt=""
                  @error="imageErrors.add(a.id)"
                />
                <template v-else>{{ initial(a.name) }}</template>
              </span>
              <span class="actor-card__name">{{ a.name }}</span>
            </RouterLink>
            <button
              v-if="canEditPhoto(a)"
              type="button"
              class="actor-card__photo-action"
              :aria-label="`Сменить фото: ${a.name}`"
              @click="editPhoto(a)"
            >
              <BaseIcon name="ph:camera" :width="18" :height="18" />
            </button>
          </div>
        </div>

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
    <ActorPhotoEditor
      v-if="editingActor"
      v-model="photoOpen"
      :actor="editingActor"
    />
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/layout" as *;

.actors-page {
  width: 100%;

  &__content {
    @include pageContentContainer;
    align-items: stretch;
  }

  &__empty {
    min-height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fv-color-text-secondary);
    text-align: center;
  }

  &__pagination {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
    padding-bottom: 1rem;
  }
}

// Эталон: сетка карточек актёров (аватар-круг + имя)
.actors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 20px;
  width: 100%;
  margin: 0.5rem 0 2rem;
}

.actor-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  text-align: center;
  text-decoration: none;
  border-radius: var(--fv-radius-md);
  background: var(--fv-color-bg-primary);
  border: 1px solid color-mix(in srgb, var(--fv-color-border) 55%, transparent);
  box-shadow: var(--fv-shadow-card);
  transition:
    transform var(--fv-motion-base) var(--fv-ease),
    box-shadow var(--fv-motion-base) var(--fv-ease);

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--fv-shadow-elevated);
  }

  &__avatar {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-family: var(--fv-font-display);
    font-weight: 500;
    font-size: 2rem;
    overflow: hidden;
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__link {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    width: 100%;
  }
  &__photo-action {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0;
    border: 1px solid var(--fv-color-border);
    border-radius: 50%;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-secondary);
    cursor: pointer;
  }

  &__name {
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.25;
    color: var(--fv-color-text-primary);
  }
}
</style>
