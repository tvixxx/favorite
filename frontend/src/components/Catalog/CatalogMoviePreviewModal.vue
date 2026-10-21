<script setup lang="ts">
import ExpandableActors from "@/components/ExpandableActors/ExpandableActors.vue";
import SectionHeading from "@/components/SectionHeading/SectionHeading.vue";
import { computed, ref, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import axios from "axios";
import { Menu as AMenu, MenuItem as AMenuItem, message } from "ant-design-vue";

import BaseModal from "@/components/BaseModal/BaseModal.vue";
import ReportReviewModal from "@/components/Reviews/ReportReviewModal.vue";
import ReviewText from "@/components/Reviews/ReviewText.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import CatalogPreviewHero from "./CatalogPreviewHero.vue";
import MoviePosterEditor from "@/components/ImagePicker/MoviePosterEditor.vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import { useRouter } from "vue-router";

import { useMainStore } from "@/state/state";
import { useMoviesStore, useUserMoviesStore } from "@/stores";
import type { Movie } from "@/stores/movies/types";

const modelValue = defineModel<boolean>({ required: true });

// После добавления произведения футер меняется на отметку + переход на полную страницу
const isAdded = ref(false);
const reportOpen = ref(false);
const posterEditorOpen = ref(false);
const reportedId = ref("");
const isMobile = useMediaQuery("(max-width: 767.98px)");

function report(id: string): void {
  reportedId.value = id;
  reportOpen.value = true;
}

const props = defineProps<{
  movieId: string | null;
}>();

const router = useRouter();
const mainStore = useMainStore();
const moviesStore = useMoviesStore();
const userMoviesStore = useUserMoviesStore();

const userId = computed(() => mainStore.userData?.id ?? "");
const movie = computed<Movie | null>(
  () =>
    moviesStore.currentMovie ??
    moviesStore.moviesList?.find((item) => item.id === props.movieId) ??
    null
);

const canEditPoster = computed(
  () =>
    !!movie.value &&
    (mainStore.userData?.role === "ADMIN" ||
      (!!userId.value && movie.value.createdById === userId.value))
);

async function reloadPoster(): Promise<void> {
  userMoviesStore.isLoaded = false;
  moviesStore.isMoviesLoaded = false;
  if (props.movieId) await moviesStore.getMovieDetail(props.movieId);
}

const previewReviews = computed(() => {
  const list = movie.value?.reviews ?? [];

  return [...list]
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return tb - ta;
    })
    .slice(0, 10);
});

const hasActors = computed(() => !!movie.value?.actors?.length);

watch(
  () => [modelValue.value, props.movieId] as const,
  async ([open, id]) => {
    reportOpen.value = false;
    posterEditorOpen.value = false;
    if (!open || !id) {
      return;
    }

    moviesStore.setCurrentMovie(null);
    isAdded.value = false;

    try {
      await moviesStore.getMovieDetail(id);
    } catch {
      message.error("Не удалось загрузить карточку");
    }
  },
  { immediate: true }
);

watch(modelValue, (open) => {
  if (!open) {
    moviesStore.setCurrentMovie(null);
  }
});

async function addToCollection() {
  const mid = props.movieId;

  if (!mid || !userId.value) {
    return;
  }

  try {
    await userMoviesStore.addUserMovie(userId.value, mid, {});
    isAdded.value = true;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      message.warning("Этот фильм уже есть в вашей коллекции");
      isAdded.value = true;

      return;
    }

    message.error("Не удалось добавить в коллекцию");
  }
}

function openFullPage(): void {
  if (!props.movieId) {
    return;
  }

  modelValue.value = false;
  void router.push(`/detail/${props.movieId}`);
}
</script>

<template>
  <BaseModal v-model="modelValue" layout="quick">
    <template #title>
      {{ movie?.title ?? "Фильм" }}
    </template>

    <template #body>
      <StateBlock
        v-if="moviesStore.isMovieError"
        compact
        v-bind="STATE_PRESETS.detailError"
        :actions="[
          {
            label: 'Повторить',
            icon: 'ph:arrow-clockwise',
            kind: 'primary',
            onClick: () => {
              if (movieId) {
                void moviesStore.getMovieDetail(movieId);
              }
            },
          },
        ]"
      />

      <div
        v-else-if="moviesStore.isMovieLoading && !movie"
        class="catalog-preview"
        aria-label="Загрузка карточки"
        aria-busy="true"
      >
        <CatalogPreviewHero :movie="null" loading />
        <div
          class="catalog-preview__section catalog-preview__placeholder"
          aria-hidden="true"
        >
          <SkeletonBar width="110px" height="20px" /><SkeletonBar
            v-for="width in ['100%', '96%', '90%', '65%']"
            :key="width"
            :width="width"
            height="18px"
            radius="5px"
          />
        </div>
        <div
          class="catalog-preview__section catalog-preview__placeholder"
          aria-hidden="true"
        >
          <SkeletonBar width="80px" height="20px" />
          <div class="catalog-preview__actors">
            <SkeletonBar
              v-for="index in 3"
              :key="index"
              width="130px"
              height="44px"
              radius="999px"
            />
          </div>
        </div>
        <div class="catalog-preview__section" aria-hidden="true">
          <SkeletonBar width="90px" height="20px" />
          <div class="catalog-preview__empty">
            <SkeletonBar width="40px" height="40px" circle /><SkeletonBar
              width="130px"
              height="18px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="movie"
        class="catalog-preview"
        :aria-busy="moviesStore.isMovieLoading"
      >
        <CatalogPreviewHero
          :movie="movie"
          :loading="moviesStore.isMovieLoading"
        />
        <a-button
          v-if="canEditPoster"
          class="catalog-preview__edit-poster"
          :disabled="moviesStore.isMovieLoading"
          @click="posterEditorOpen = true"
        >
          Изменить постер
        </a-button>

        <div v-if="movie.description?.trim()" class="catalog-preview__section">
          <SectionHeading
            compact
            tag="h3"
            class="catalog-preview__section-title"
            title="Описание"
            icon="ph:text-align-left"
          />
          <p class="catalog-preview__desc">{{ movie.description }}</p>
        </div>

        <div v-if="hasActors" class="catalog-preview__section">
          <SectionHeading
            compact
            tag="h3"
            class="catalog-preview__section-title"
            title="Актёры"
            icon="ph:users-three"
          />
          <ExpandableActors
            :actors="movie.actors ?? []"
            :reset-key="movie.id + ':' + modelValue"
            variant="preview"
            :collapsible="isMobile"
          />
        </div>

        <div class="catalog-preview__section">
          <SectionHeading
            compact
            tag="h3"
            class="catalog-preview__section-title"
            title="Отзывы"
            icon="ph:chat-text"
            :count="movie._count?.reviews"
          />

          <div v-if="previewReviews.length" class="catalog-preview__reviews">
            <article
              v-for="rev in previewReviews"
              :key="rev.id"
              class="catalog-preview__review"
            >
              <div class="catalog-preview__review-head">
                <span class="catalog-preview__review-rate"
                  >{{ rev.rate }}/10</span
                >
                <a-dropdown
                  v-if="userId && rev.userId !== userId"
                  :trigger="['click']"
                >
                  <a-button type="text" aria-label="Действия с отзывом"
                    ><BaseIcon name="ph:dots-three" :width="24" :height="24"
                  /></a-button>
                  <template #overlay
                    ><a-menu
                      ><a-menu-item key="report" @click="report(rev.id)"
                        >Пожаловаться</a-menu-item
                      ></a-menu
                    ></template
                  >
                </a-dropdown>
              </div>
              <ReviewText
                class="catalog-preview__review-text"
                :review-id="rev.id"
                :text="rev.text"
                :is-spoiler="rev.isSpoiler"
              />
            </article>
          </div>

          <div v-else class="catalog-preview__empty">
            <BaseIcon name="ph:chat-text" :width="40" :height="40" />
            <p>Отзывов пока нет.</p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <template v-if="isAdded">
        <span class="catalog-preview__added">
          <BaseIcon name="ph:check-circle" :width="19" :height="19" />
          Добавлено в коллекцию
        </span>
        <a-button size="large" @click="openFullPage">Открыть страницу</a-button>
      </template>
      <a-button
        v-else
        type="primary"
        size="large"
        class="catalog-preview__cta"
        :disabled="
          moviesStore.isMovieLoading || !movie || !!moviesStore.isMovieError
        "
        @click="addToCollection"
      >
        <BaseIcon name="ph:plus-circle" :width="19" :height="19" />
        Добавить в мою коллекцию
      </a-button>
    </template>
  </BaseModal>
  <MoviePosterEditor
    v-if="movie && posterEditorOpen && canEditPoster"
    v-model="posterEditorOpen"
    :movie="movie"
    @saved="reloadPoster"
  />
  <ReportReviewModal v-model="reportOpen" :review-id="reportedId" />
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.catalog-preview {
  padding-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.catalog-preview__placeholder {
  display: grid;
  gap: 8px;
}

.catalog-preview__added {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
  color: var(--fv-color-positive);
  font-size: 15px;
  font-weight: 500;
}

// На мобиле CTA во всю ширину, высота как у остальных действий формы.
@include mediaMax($tablet - 0.02px) {
  .catalog-preview__cta {
    width: 100%;
    height: 44px;
    font-size: 14px;
  }
}

.catalog-preview__section {
  padding: 13px 15px;
  border-radius: 14px;
  background: var(--fv-color-bg-secondary);
}

.catalog-preview__section-title {
  margin: 0 0 6px;
}

.catalog-preview__count {
  margin-left: auto;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--fv-color-bg-primary);
  border: 1px solid var(--fv-color-border);
  color: var(--fv-color-text-secondary);
}

.catalog-preview__desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--fv-color-text-primary);
  white-space: pre-wrap;
}

.catalog-preview__actors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.catalog-preview__reviews {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.catalog-preview__review {
  padding: 0.65rem 0.85rem;
  border-radius: var(--fv-radius-sm);
  background: var(--fv-color-bg-primary);
  border: 1px solid var(--fv-color-border);
}

.catalog-preview__review-head {
  margin-bottom: 0.35rem;
}

.catalog-preview__review-rate {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fv-color-accent);
}

.catalog-preview__review-text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.45;
  color: var(--fv-color-text-primary);
}

.catalog-preview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.25rem;
  text-align: center;
  color: var(--fv-color-text-secondary);
  font-size: 0.95rem;

  svg {
    opacity: 0.45;
  }
}
</style>
