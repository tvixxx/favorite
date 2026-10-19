<script setup lang="ts">
import MovieProgressSection from "@/components/MovieProgress/MovieProgressSection.vue";
import { useMovieProgress } from "@/composable/useMovieProgress";
import ExpandableActors from "@/components/ExpandableActors/ExpandableActors.vue";
import AddMovieToListModal from "@/components/UserLists/AddMovieToListModal.vue";
import SectionHeading from "@/components/SectionHeading/SectionHeading.vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { useRoute, useRouter } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import { message } from "ant-design-vue";

import { useMainStore } from "@/state/state";
import { useUserMoviesStore } from "@/stores";
import { formatYear, PLURAL, pluralize } from "@/utils";
import { useDateTime } from "@/composable/useDateTime";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import MoviePoster from "@/components/MoviePoster/MoviePoster.vue";
import { GenreLabels } from "@/components/Genres/constants/genres.constants";
import { countriesLabelsRu } from "@/constants/countries/production-countries";
import { MOVIES_ENDPOINTS } from "@/constants";
import { isSuccessStatus } from "@/utils";
import { useNavigateBack } from "@/composable/useNavigateBack";
import { createRequestGuard } from "@/utils/requestGuard";
import { FETCH_METHOD, useFetch } from "@/composable";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import MovieShareButton from "@/components/MovieShareButton/MovieShareButton.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import DetailSkeleton from "@/components/Skeleton/DetailSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import type { UserMovie } from "@/stores";
import ReviewsWidget from "@/components/Reviews/ReviewsWidget.vue";
import { useReviews } from "@/composable/useReviews";
import WatchStatusSelect from "@/components/WatchStatusSelect/WatchStatusSelect.vue";
import RateMovieModal from "@/components/RateMovieModal/RateMovieModal.vue";
import MoviePosterEditor from "@/components/ImagePicker/MoviePosterEditor.vue";
import ContentTypeEditor from "@/components/ContentType/ContentTypeEditor.vue";
import WatchDiary from "@/components/WatchDiary/WatchDiary.vue";
import { toDiaryMovie } from "@/services/watch-diary-api";
import { contentTypeLabel, type ContentKind } from "@/utils/content-kind";
import type { ImageSelection } from "@/services/media";
import CatalogMoviePreviewModal from "@/components/Catalog/CatalogMoviePreviewModal.vue";

const mainStore = useMainStore();
const { formatDate } = useDateTime();
const userMoviesStore = useUserMoviesStore();
const router = useRouter();
const route = useRoute();
const { navigateBack } = useNavigateBack();

const detailBackFallback = computed((): RouteLocationRaw => {
  const raw = route.query.libActor;
  const actorId =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && typeof raw[0] === "string"
      ? raw[0]
      : "";

  if (actorId) {
    return { path: `/library/actors/${actorId}` };
  }

  return { path: "/library/collection" };
});

const crumbParentLabel = computed(() =>
  route.query.libActor ? "Актёры" : "Моя коллекция"
);

const goToCrumbParent = (): void => {
  router.push(detailBackFallback.value);
};

const goToActor = (actorId: string): void => {
  router.push({ name: "library-actor", params: { actorId } });
};

const isMobile = useMediaQuery("(max-width: 767.98px)");

type DetailTab = "overview" | "progress" | "reviews";

const activeTab = ref<DetailTab>("overview");

const { totalReviews: reviewsTotal } = useReviews();

const detailTabs = computed<
  Array<{ key: DetailTab; label: string; count: number }>
>(() => {
  const tabs: Array<{ key: DetailTab; label: string; count: number }> = [
    { key: "overview", label: "Обзор", count: 0 },
  ];

  if (hasSerialProgress.value) {
    tabs.push({ key: "progress", label: "Прогресс", count: 0 });
  }

  tabs.push({ key: "reviews", label: "Отзывы", count: reviewsTotal.value });

  return tabs;
});

const effectiveTab = computed<DetailTab>(() =>
  detailTabs.value.some((tab) => tab.key === activeTab.value)
    ? activeTab.value
    : "overview"
);

const showTab = (tab: DetailTab): boolean =>
  !isMobile.value || effectiveTab.value === tab;

interface SimilarMovie {
  contentKind?: ContentKind | null;
  movieId: string;
  title: string;
  isSerial: boolean;
  publishDate: string | null;
  posterUrl: string | null;
}

const similarMovies = ref<SimilarMovie[]>([]);
const similarRequests = createRequestGuard();

const loadSimilar = async (movieId: string): Promise<void> => {
  const isCurrent = similarRequests.begin();

  try {
    const { data, status } = await useFetch<SimilarMovie[]>(
      `${MOVIES_ENDPOINTS}/${movieId}/similar?limit=4`,
      { method: FETCH_METHOD.get }
    );

    if (isCurrent()) {
      similarMovies.value = isSuccessStatus(status) ? data ?? [] : [];
    }
  } catch {
    if (isCurrent()) {
      similarMovies.value = [];
    }
  }
};

const openSimilar = (movieId: string): void => {
  router.push({ name: "detail", params: { id: movieId } });
};

const isRateModalVisible = ref(false);

const onRateSaved = (updated: UserMovie): void => {
  currentUserMovie.value = updated;
};

const currentMovieId = computed<string | null>(() => {
  const raw = route.params.id;

  return typeof raw === "string" && raw ? raw : null;
});
const userId = computed(() => mainStore.userData?.id || "");

const isLoading = ref(false);
const showSkeleton = useMinLoading(() => isLoading.value);
const isError = ref<string | null>(null);
const currentUserMovie = ref<UserMovie | null>(null);
const progress = useMovieProgress(currentUserMovie, userId);
const { isEditingProgress, isProgressSaving, watchStatusModel } = progress;
const catalogPreviewId = ref<string | null>(null);
const catalogPreviewOpen = ref(false);
const isListsModalVisible = ref(false);
const detailRequests = createRequestGuard();

const loadDetail = async (): Promise<void> => {
  const movieId = currentMovieId.value;

  if (!mainStore.isLoggedIn || !userId.value || !movieId) {
    return;
  }

  const isCurrent = detailRequests.begin();

  isError.value = null;

  const cached = userMoviesStore.userMovies.find(
    (um) => um.movieId === movieId
  );

  if (cached) {
    currentUserMovie.value = cached;
  }

  isLoading.value = !cached;

  try {
    const loaded = await userMoviesStore.fetchUserMovieById(
      userId.value,
      movieId
    );

    if (!isCurrent()) {
      return;
    }

    if (loaded) {
      currentUserMovie.value = loaded;
      catalogPreviewId.value = null;
      catalogPreviewOpen.value = false;
    } else {
      currentUserMovie.value = null;
      catalogPreviewId.value = movieId;
      catalogPreviewOpen.value = true;
    }
  } catch {
    if (!isCurrent()) {
      return;
    }

    if (!cached) {
      message.error("Не удалось загрузить фильм");
      isError.value = "Не удалось загрузить фильм";
    }
  } finally {
    if (isCurrent()) {
      isLoading.value = false;
    }
  }

  void loadSimilar(movieId);
};

onMounted(loadDetail);

onBeforeUnmount(() => {
  detailRequests.invalidate();
  similarRequests.invalidate();
  currentUserMovie.value = null;
});

watch(catalogPreviewOpen, async (open) => {
  const id = catalogPreviewId.value;

  if (open || !id || id !== currentMovieId.value) {
    return;
  }

  catalogPreviewId.value = null;

  const isCurrent = detailRequests.begin();

  isLoading.value = true;
  try {
    const own = await userMoviesStore.fetchUserMovieById(userId.value, id);

    if (!isCurrent()) return;
    if (own) {
      currentUserMovie.value = own;
      void loadSimilar(id);
    } else {
      const actorId = route.query.libActor;

      void router.replace(
        typeof actorId === "string"
          ? `/library/actors/${actorId}`
          : "/library/catalog"
      );
    }
  } catch {
    if (isCurrent()) isError.value = "Не удалось проверить коллекцию";
  } finally {
    if (isCurrent()) isLoading.value = false;
  }
});

watch(currentMovieId, (next, prev) => {
  if (!next || next === prev) {
    return;
  }

  currentUserMovie.value = null;
  catalogPreviewId.value = null;
  catalogPreviewOpen.value = false;
  similarMovies.value = [];
  similarRequests.invalidate();
  activeTab.value = "overview";
  isEditingProgress.value = false;
  void loadDetail();
});

const movie = computed(() => currentUserMovie.value?.movie);
const diaryMovie = computed(() =>
  movie.value ? toDiaryMovie(movie.value) : undefined
);
const posterSrc = computed(() => movie.value?.imageUrl || FALLBACK_IMAGE_URL);
const posterEditorOpen = ref(false);
const typeEditorOpen = ref(false);

async function onTypeSaved(): Promise<void> {
  userMoviesStore.isLoaded = false;
  await loadDetail();
}

const canEditPoster = computed(
  () =>
    mainStore.userData?.role === "ADMIN" ||
    (!!movie.value?.createdById &&
      movie.value.createdById === mainStore.userData?.id)
);

watch(currentMovieId, () => {
  posterEditorOpen.value = false;
  typeEditorOpen.value = false;
});

function onPosterSaved(selection: ImageSelection | null): void {
  if (!currentUserMovie.value) {
    return;
  }

  const updatedMovie = {
    ...currentUserMovie.value.movie,
    imageUrl: selection?.url ?? "",
    imageThumbnailUrl: selection?.thumbnailUrl ?? undefined,
    posterAssetId: selection?.assetId ?? null,
  };

  currentUserMovie.value = { ...currentUserMovie.value, movie: updatedMovie };
  userMoviesStore.userMovies = userMoviesStore.userMovies.map((item) =>
    item.movieId === updatedMovie.id ? { ...item, movie: updatedMovie } : item
  );
}

const hasAverageRating = computed(
  () =>
    movie.value?.averageRating !== null &&
    movie.value?.averageRating !== undefined
);

const averageRatingPercent = computed(() => {
  const avg = movie.value?.averageRating;

  if (avg === null || avg === undefined) {
    return 0;
  }

  return Math.max(0, Math.min(100, avg * 10));
});

const averageRatingLabel = computed(() => {
  const avg = movie.value?.averageRating;

  if (avg === null || avg === undefined) {
    return "нет";
  }

  return avg.toFixed(1).replace(".", ",");
});

const seasonsEpisodesLabel = computed(() => {
  const parts: string[] = [];

  if (movie.value?.seasonCount) {
    parts.push(pluralize(movie.value.seasonCount, PLURAL.season));
  }

  if (movie.value?.episodeCount) {
    parts.push(pluralize(movie.value.episodeCount, PLURAL.episode));
  }

  return parts.join(", ");
});

const actorCount = computed(() => movie.value?.actors?.length ?? 0);

const toggleFavorite = async () => {
  if (!currentUserMovie.value) {
    return;
  }

  try {
    const newValue = !currentUserMovie.value.isFavorite;

    await userMoviesStore.updateUserMovie(
      userId.value,
      currentUserMovie.value.movieId,
      {
        isFavorite: newValue,
      }
    );

    currentUserMovie.value = {
      ...currentUserMovie.value,
      isFavorite: newValue,
    };

    message.success(
      newValue
        ? `"${movie.value?.title}" добавлен в избранное`
        : `"${movie.value?.title}" убран из избранного`
    );
  } catch {
    message.error("Не удалось обновить избранное");
  }
};

const toggleSeeLater = async () => {
  if (!currentUserMovie.value) {
    return;
  }

  const newValue = !currentUserMovie.value.seeLater;

  try {
    await userMoviesStore.updateUserMovie(
      userId.value,
      currentUserMovie.value.movieId,
      {
        seeLater: newValue,
      }
    );

    currentUserMovie.value = { ...currentUserMovie.value, seeLater: newValue };

    message.success(
      newValue
        ? `${movie.value?.title} добавлен в «Смотреть позже»`
        : `${movie.value?.title} убран из «Смотреть позже»`
    );
  } catch {
    message.error("Не удалось обновить статус");
  }
};

const hasSerialProgress = computed(() => !!movie.value?.isSerial);

const openListsModal = (): void => {
  if (!userId.value) {
    return;
  }

  isListsModalVisible.value = true;
};
</script>

<template>
  <div class="movie-detail">
    <div class="movie-detail__content">
      <nav class="detail-crumbs" aria-label="Навигация">
        <button
          type="button"
          class="detail-crumbs__link"
          @click="goToCrumbParent"
        >
          {{ crumbParentLabel }}
        </button>
        <BaseIcon
          class="detail-crumbs__sep"
          name="ph:caret-right"
          :width="12"
          :height="12"
        />
        <span class="detail-crumbs__current" :title="movie?.title ?? 'Детали'">
          {{ movie?.title ?? "Детали" }}
        </span>
      </nav>

      <StateBlock
        v-if="isError"
        v-bind="STATE_PRESETS.detailError"
        :actions="[
          {
            label: 'Повторить',
            icon: 'ph:arrow-clockwise',
            kind: 'primary',
            onClick: loadDetail,
          },
          {
            label: 'Назад',
            icon: 'ph:arrow-left',
            kind: 'ghost',
            onClick: () => navigateBack({ fallback: detailBackFallback }),
          },
        ]"
      />

      <DetailSkeleton v-else-if="showSkeleton" layout="page" />

      <template v-else-if="currentUserMovie && movie">
        <!-- Мобильный hero (эталон): постер на весь экран, поверх — навигация,
             чипы года/типа и название; ниже рейтинг и быстрые действия -->
        <template v-if="isMobile">
          <div class="detail-hero">
            <MoviePoster
              class="detail-hero__bg"
              :src="posterSrc"
              :seed="movie.id"
              :title="movie.title"
              :alt="movie.title"
            />
            <div class="detail-hero__scrim"></div>

            <button
              type="button"
              class="detail-hero__nav"
              aria-label="Назад"
              @click="goToCrumbParent"
            >
              <BaseIcon name="ph:arrow-left" :width="19" :height="19" />
            </button>

            <button
              type="button"
              class="detail-hero__nav detail-hero__nav_right"
              :class="{ 'detail-hero__nav_on': currentUserMovie.isFavorite }"
              :aria-label="
                currentUserMovie.isFavorite
                  ? 'Убрать из избранного'
                  : 'Добавить в избранное'
              "
              @click="toggleFavorite"
            >
              <BaseIcon
                :name="
                  currentUserMovie.isFavorite ? 'ph:heart-fill' : 'ph:heart'
                "
                :width="18"
                :height="18"
              />
            </button>

            <div class="detail-hero__bottom">
              <div class="detail-hero__chips">
                <span v-if="movie.publishDate" class="detail-hero__chip">
                  {{ formatYear(movie.publishDate) }}
                </span>
                <button
                  v-if="canEditPoster"
                  type="button"
                  class="detail-hero__chip detail-type-edit"
                  :aria-label="'Изменить тип: ' + contentTypeLabel(movie)"
                  @click="typeEditorOpen = true"
                >
                  {{ contentTypeLabel(movie) }}
                  <BaseIcon name="ph:pencil-simple" :width="14" :height="14" />
                </button>
                <span v-else class="detail-hero__chip">{{
                  contentTypeLabel(movie)
                }}</span>
              </div>
              <h1 class="detail-hero__title">{{ movie.title }}</h1>
            </div>
          </div>

          <div class="detail-mobile-bar">
            <div class="detail-mobile-rate">
              <span class="detail-mobile-rate__num">
                {{ hasAverageRating ? averageRatingLabel : "—" }}
              </span>
              <span class="detail-mobile-rate__max">/10</span>
              <span class="detail-mobile-rate__track">
                <span
                  class="detail-mobile-rate__fill"
                  :style="{ width: `${averageRatingPercent}%` }"
                />
              </span>
            </div>

            <div class="detail-mobile-status">
              <span class="detail-mobile-status__label">Статус</span>
              <WatchStatusSelect
                v-model="watchStatusModel"
                :disabled="isProgressSaving"
              />
            </div>

            <div class="detail-mobile-actions">
              <button
                v-if="canEditPoster"
                type="button"
                class="detail-mobile-actions__icon"
                aria-label="Изменить постер"
                @click="posterEditorOpen = true"
              >
                <BaseIcon name="ph:image" :width="20" :height="20" />
              </button>
              <MovieShareButton
                v-if="currentMovieId"
                :movie-id="currentMovieId"
                :movie-title="movie.title"
              />
              <button
                type="button"
                class="detail-mobile-actions__icon"
                :class="{
                  'detail-mobile-actions__icon_on': currentUserMovie.seeLater,
                }"
                aria-label="Смотреть позже"
                :aria-pressed="currentUserMovie.seeLater"
                @click="toggleSeeLater"
              >
                <BaseIcon name="ph:clock" :width="20" :height="20" />
              </button>
            </div>
          </div>
        </template>

        <div class="detail-grid">
          <div class="detail-main">
            <div v-if="isMobile" class="detail-tabs" role="tablist">
              <button
                v-for="tab in detailTabs"
                :key="tab.key"
                type="button"
                role="tab"
                class="detail-tabs__btn"
                :class="{ 'detail-tabs__btn--on': activeTab === tab.key }"
                :aria-selected="activeTab === tab.key"
                @click="activeTab = tab.key"
              >
                {{ tab.label }}
                <span v-if="tab.count" class="detail-tabs__count">
                  {{ tab.count }}
                </span>
              </button>
            </div>

            <div v-show="showTab('overview')" class="detail-tabpanel">
              <div
                v-if="movie.description || movie.genres?.length"
                class="detail-section"
              >
                <SectionHeading
                  class="detail-section__title"
                  :title="
                    movie.descriptionLanguage === 'en'
                      ? 'Описание на английском'
                      : 'Описание'
                  "
                  icon="ph:text-align-left"
                />
                <p
                  v-if="movie.titleEn || movie.originalTitle"
                  class="detail-section__text"
                >
                  {{ movie.titleEn
                  }}<template
                    v-if="
                      movie.originalTitle &&
                      movie.originalTitle !== movie.titleEn
                    "
                  >
                    · Оригинал: {{ movie.originalTitle }}</template
                  >
                </p>
                <p v-if="movie.description" class="detail-section__text">
                  {{ movie.description }}
                </p>
                <p v-if="movie.tvdbId" class="detail-section__text">
                  Источник:
                  <a
                    class="detail-section__source-link"
                    href="https://thetvdb.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    >TheTVDB
                    <BaseIcon
                      name="ph:arrow-up-right"
                      :width="14"
                      :height="14"
                      aria-hidden="true"
                  /></a>
                </p>
                <!-- Жанры: в панели их нет (эталон — метастрока год·тип·страны) -->
                <div v-if="movie.genres?.length" class="detail-genres">
                  <span
                    v-for="g in movie.genres"
                    :key="g"
                    class="detail-genres__chip"
                  >
                    {{ GenreLabels[g] ?? g }}
                  </span>
                </div>
              </div>

              <WatchDiary
                v-if="diaryMovie"
                :key="diaryMovie.id"
                class="detail-section"
                compact
                :movie="diaryMovie"
                @collection-updated="onTypeSaved"
              />

              <div v-if="actorCount" class="detail-section">
                <SectionHeading
                  class="detail-section__title"
                  title="Актёры"
                  icon="ph:users-three"
                />
                <ExpandableActors
                  :actors="movie.actors ?? []"
                  :reset-key="movie.id"
                  variant="detail"
                  @select="goToActor"
                />
              </div>

              <div v-if="isMobile" class="detail-section detail-info">
                <div v-if="movie.countryCodes?.length" class="detail-info__row">
                  <span class="detail-info__label">
                    <BaseIcon name="ph:globe" :width="18" :height="18" />
                    Страны
                  </span>
                  <b class="detail-info__value">
                    {{ countriesLabelsRu(movie.countryCodes) }}
                  </b>
                </div>

                <div
                  v-if="movie.isSerial && movie.seasonCount"
                  class="detail-info__row"
                >
                  <span class="detail-info__label">
                    <BaseIcon name="ph:monitor" :width="18" :height="18" />
                    Сезонов
                  </span>
                  <b class="detail-info__value">{{ movie.seasonCount }}</b>
                </div>

                <div
                  v-if="movie.isSerial && movie.episodeCount"
                  class="detail-info__row"
                >
                  <span class="detail-info__label">
                    <BaseIcon name="ph:playlist" :width="18" :height="18" />
                    Эпизодов
                  </span>
                  <b class="detail-info__value">{{ movie.episodeCount }}</b>
                </div>

                <div v-if="currentUserMovie.addedAt" class="detail-info__row">
                  <span class="detail-info__label">
                    <BaseIcon name="ph:eye" :width="18" :height="18" />
                    Добавлено
                  </span>
                  <b class="detail-info__value detail-info__value--date">
                    {{ formatDate(currentUserMovie.addedAt) }}
                  </b>
                </div>
              </div>
            </div>

            <div v-show="showTab('progress')" class="detail-tabpanel">
              <MovieProgressSection
                v-if="hasSerialProgress"
                :progress="progress"
              />
            </div>

            <div v-show="showTab('reviews')" class="detail-tabpanel">
              <div
                v-if="currentMovieId"
                class="movie-detail__review-widget review-widget"
              >
                <ReviewsWidget
                  :movie-id="currentMovieId"
                  @changed="loadDetail"
                />
              </div>
            </div>

            <!-- «Похожее» — последний блок страницы (эталон); на мобилке живёт в «Обзоре» -->
            <div
              v-if="similarMovies.length && showTab('overview')"
              class="detail-section detail-section--similar"
            >
              <SectionHeading
                class="detail-section__title"
                title="Похожее из вашей коллекции"
                icon="ph:squares-four"
              />
              <div class="similar-grid">
                <button
                  v-for="item in similarMovies"
                  :key="item.movieId"
                  type="button"
                  class="similar-card"
                  @click="openSimilar(item.movieId)"
                >
                  <span class="similar-card__poster">
                    <MoviePoster
                      :src="item.posterUrl"
                      :seed="item.movieId"
                      :title="item.title"
                      :alt="item.title"
                      loading="lazy"
                    />
                  </span>
                  <span class="similar-card__title">{{ item.title }}</span>
                  <span class="similar-card__meta">
                    <template v-if="item.publishDate">
                      {{ formatYear(item.publishDate) }} ·
                    </template>
                    {{ contentTypeLabel(item) }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <aside class="detail-side">
            <div class="detail-panel">
              <div class="detail-panel__head">
                <div class="detail-panel__poster">
                  <MoviePoster
                    :src="posterSrc"
                    :seed="movie.id"
                    :title="movie.title"
                    :alt="`${movie.title} постер`"
                    class="detail-panel__poster-img"
                  />
                  <button
                    v-if="canEditPoster"
                    type="button"
                    class="detail-panel__poster-edit"
                    aria-label="Изменить постер"
                    title="Изменить постер"
                    @click="posterEditorOpen = true"
                  >
                    <BaseIcon
                      name="ph:pencil-simple"
                      :width="18"
                      :height="18"
                    />
                  </button>
                </div>

                <div class="detail-panel__info">
                  <h1 class="detail-panel__title">{{ movie.title }}</h1>
                  <!-- Метастрока вместо чипов: это факты, а не фильтры -->
                  <div class="detail-panel__meta">
                    <span
                      v-if="movie.publishDate"
                      class="detail-panel__meta-item"
                    >
                      <BaseIcon
                        name="ph:calendar-blank"
                        :width="13"
                        :height="13"
                      />
                      {{ formatYear(movie.publishDate) }}
                    </span>
                    <button
                      v-if="canEditPoster"
                      type="button"
                      class="detail-panel__meta-item detail-type-edit"
                      :aria-label="'Изменить тип: ' + contentTypeLabel(movie)"
                      @click="typeEditorOpen = true"
                    >
                      <BaseIcon
                        :name="movie.isSerial ? 'ph:monitor' : 'ph:film-slate'"
                        :width="13"
                        :height="13"
                      />
                      {{ contentTypeLabel(movie) }}
                      <BaseIcon
                        name="ph:pencil-simple"
                        :width="14"
                        :height="14"
                      />
                    </button>
                    <span
                      v-else
                      class="detail-panel__meta-item detail-panel__meta-item_kind"
                    >
                      <BaseIcon
                        :name="movie.isSerial ? 'ph:monitor' : 'ph:film-slate'"
                        :width="13"
                        :height="13"
                      />
                      {{ contentTypeLabel(movie) }}
                    </span>
                    <span
                      v-if="movie.countryCodes?.length"
                      class="detail-panel__meta-item detail-panel__meta-item_country"
                    >
                      <BaseIcon name="ph:globe" :width="13" :height="13" />
                      {{ countriesLabelsRu(movie.countryCodes) }}
                    </span>
                  </div>
                </div>

                <div class="detail-panel__rates">
                  <div class="detail-panel__rate">
                    <span class="detail-panel__rate-label">Моя оценка</span>
                    <span class="detail-panel__rate-value">
                      <b
                        class="detail-panel__rate-num detail-panel__rate-num_mine"
                        :class="{
                          'detail-panel__rate-num_empty':
                            !currentUserMovie.personalRate,
                        }"
                      >
                        {{ currentUserMovie.personalRate || "нет" }}
                      </b>
                      <span
                        v-if="currentUserMovie.personalRate"
                        class="detail-panel__rate-max"
                      >
                        /10
                      </span>
                    </span>
                  </div>
                  <div class="detail-panel__rate">
                    <span class="detail-panel__rate-label">По отзывам</span>
                    <span class="detail-panel__rate-value">
                      <b
                        class="detail-panel__rate-num"
                        :class="{
                          'detail-panel__rate-num_empty': !hasAverageRating,
                        }"
                      >
                        {{ averageRatingLabel }}
                      </b>
                      <span
                        v-if="hasAverageRating"
                        class="detail-panel__rate-max"
                      >
                        /10
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Статус просмотра (эталон 1c): единственная точка управления -->
              <div class="detail-panel__status">
                <span class="detail-panel__status-label">Статус</span>
                <WatchStatusSelect
                  v-model="watchStatusModel"
                  :disabled="isProgressSaving"
                />
              </div>

              <a-button
                type="primary"
                class="detail-panel__rate-cta"
                @click="isRateModalVisible = true"
              >
                <BaseIcon name="ph:star" :width="18" :height="18" />
                {{
                  currentUserMovie.personalRate ? "Изменить оценку" : "Оценить"
                }}
              </a-button>

              <div class="detail-panel__actions">
                <button
                  type="button"
                  class="detail-panel__action"
                  :class="{
                    'detail-panel__action_fav': currentUserMovie.isFavorite,
                  }"
                  :title="
                    currentUserMovie.isFavorite
                      ? 'В избранном'
                      : 'Добавить в избранное'
                  "
                  :aria-label="
                    currentUserMovie.isFavorite
                      ? 'Убрать из избранного'
                      : 'Добавить в избранное'
                  "
                  @click="toggleFavorite"
                >
                  <BaseIcon
                    :name="
                      currentUserMovie.isFavorite ? 'ph:heart-fill' : 'ph:heart'
                    "
                    :width="20"
                    :height="20"
                  />
                </button>

                <button
                  type="button"
                  class="detail-panel__action"
                  title="Добавить в список"
                  aria-label="Добавить в список"
                  @click="openListsModal"
                >
                  <BaseIcon name="ph:list-plus" :width="20" :height="20" />
                </button>

                <MovieShareButton
                  v-if="currentMovieId"
                  compact
                  :movie-id="currentMovieId"
                  :movie-title="movie.title"
                />

                <button
                  type="button"
                  class="detail-panel__action"
                  :class="{
                    'detail-panel__action_on': currentUserMovie.seeLater,
                  }"
                  :title="
                    currentUserMovie.seeLater
                      ? 'В списке «Смотреть позже»'
                      : 'Смотреть позже'
                  "
                  aria-label="Смотреть позже"
                  :aria-pressed="currentUserMovie.seeLater"
                  @click="toggleSeeLater"
                >
                  <BaseIcon name="ph:clock" :width="20" :height="20" />
                </button>
              </div>

              <p
                v-if="
                  currentUserMovie.addedAt ||
                  (movie.isSerial && seasonsEpisodesLabel)
                "
                class="detail-panel__footnote"
              >
                <template v-if="currentUserMovie.addedAt">
                  Добавлено {{ formatDate(currentUserMovie.addedAt) }}
                </template>
                <template v-if="movie.isSerial && seasonsEpisodesLabel">
                  · {{ seasonsEpisodesLabel }}
                </template>
              </p>
            </div>
          </aside>
        </div>

        <!-- Мобилка: липкая панель действий над таб-баром (эталон) -->
        <div v-if="isMobile" class="detail-actionbar">
          <a-button
            type="primary"
            class="detail-actionbar__primary"
            @click="isRateModalVisible = true"
          >
            <BaseIcon name="ph:star" :width="18" :height="18" />
            {{ currentUserMovie.personalRate ? "Изменить оценку" : "Оценить" }}
          </a-button>
          <button
            type="button"
            class="detail-actionbar__icon"
            aria-label="Добавить в список"
            @click="openListsModal"
          >
            <BaseIcon name="ph:list-plus" :width="20" :height="20" />
          </button>
        </div>
      </template>
    </div>
  </div>

  <CatalogMoviePreviewModal
    v-if="catalogPreviewId"
    v-model="catalogPreviewOpen"
    :movie-id="catalogPreviewId"
  />

  <ContentTypeEditor
    v-if="movie && typeEditorOpen && canEditPoster"
    v-model="typeEditorOpen"
    :movie="movie"
    @saved="onTypeSaved"
  />

  <MoviePosterEditor
    v-if="movie && posterEditorOpen"
    v-model="posterEditorOpen"
    :movie="movie"
    @saved="onPosterSaved"
  />

  <RateMovieModal
    v-if="currentMovieId && movie"
    v-model="isRateModalVisible"
    :movie-id="currentMovieId"
    :title="movie.title"
    :year="movie.publishDate ? formatYear(movie.publishDate) : ''"
    :kind="contentTypeLabel(movie)"
    :poster-url="movie.imageUrl"
    :personal-rate="currentUserMovie?.personalRate"
    @saved="onRateSaved"
  />

  <AddMovieToListModal
    v-model="isListsModalVisible"
    :user-id="userId"
    :movie-id="currentUserMovie?.movieId ?? null"
  />
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;
@use "@/styles/scrollbar" as *;
@use "@/styles/layout" as *;

.detail-type-edit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.detail-type-edit:focus-visible {
  outline: 2px solid var(--fv-color-accent);
  outline-offset: 3px;
}

.detail-section__source-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
  text-decoration: none;

  &:hover {
    color: var(--fv-color-accent);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 3px;
  }
}

.movie-detail {
  @include pageShell(4rem);

  &__content {
    max-width: 1180px;
    margin: 0 auto;
    padding: 2rem 1rem 0;
    text-align: left;

    @include mediaTablet {
      padding: 2.5rem 2rem 0;
    }
  }
}

.detail-crumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--fv-color-text-secondary);

  &__link {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    color: var(--fv-color-text-secondary);
    cursor: pointer;

    &:hover {
      color: var(--fv-color-text-primary);
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
      border-radius: 4px;
    }
  }

  &__sep {
    flex-shrink: 0;
    color: var(--fv-color-text-tertiary);
  }

  &__current {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--fv-color-text-primary);
    font-weight: 500;
    min-width: 0;
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 348px;
  gap: 22px;
  align-items: start;

  @include mediaMax(1080px) {
    grid-template-columns: 1fr;
  }
}

.detail-main {
  min-width: 0;

  > .detail-section:first-child,
  > .detail-tabpanel:first-child > .detail-section:first-child {
    margin-top: 0;
  }
}

.detail-side {
  position: sticky;
  top: 80px;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  padding: 8px;
  margin: -8px;
  @include customScrollbar();

  @include mediaMax(1080px) {
    position: static;
    order: -1;
    max-height: none;
    overflow: visible;
    margin: 0;
    padding: 0;
  }
}

.detail-panel {
  padding: 22px;
  border-radius: var(--fv-radius-lg);
  background: var(--fv-color-bg-primary);
  box-shadow: var(--fv-shadow-low);
  text-align: left;

  &__head {
    display: grid;
    grid-template-columns: 112px 1fr;
    grid-template-areas: "poster info" "rates rates";
    gap: 16px;
    align-items: start;
    margin-bottom: 18px;

    @include mediaMax(1080px) {
      grid-template-columns: 150px 1fr;
      grid-template-areas: "poster info" "poster rates";
      gap: 10px 22px;
      align-content: start;
    }
  }

  &__poster {
    position: relative;
    grid-area: poster;
    aspect-ratio: 2 / 3;
    border-radius: 14px;
    overflow: hidden;
    background: var(--fv-color-bg-secondary);
  }

  &__poster-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__poster-edit {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--fv-color-border);
    border-radius: 50%;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-secondary);
    box-shadow: var(--fv-shadow-low);
    cursor: pointer;

    &:hover {
      background: var(--fv-color-bg-secondary);
      color: var(--fv-color-text-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }
  }

  &__info {
    grid-area: info;
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-family: var(--fv-font-ui);
    font-size: 20px;
    font-weight: 500;
    line-height: 1.2;
    color: var(--fv-color-text-primary);
  }

  &__meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-top: 8px;
    font-size: 13px;
    color: var(--fv-color-text-secondary);
  }

  &__meta-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 20px;
    line-height: 20px;
    text-align: left;

    > :deep(svg) {
      flex-shrink: 0;
    }

    &.detail-type-edit {
      min-height: 24px;
      padding: 0;
    }
  }

  &__rates {
    grid-area: rates;
    display: flex;
    gap: 12px;
  }

  &__rate {
    flex: 1;
    min-width: 0;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--fv-color-bg-secondary);
  }

  &__rate-label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--fv-color-text-secondary);
  }

  &__rate-value {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  &__rate-num {
    font-family: var(--fv-font-display);
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    color: var(--fv-color-text-primary);

    &_mine {
      color: var(--fv-color-accent);
    }

    &_empty {
      font-family: var(--fv-font-ui);
      font-size: 17px;
      font-weight: 500;
      color: var(--fv-color-text-tertiary);
    }
  }

  &__rate-max {
    font-size: 13px;
    color: var(--fv-color-text-tertiary);
  }

  &__status {
    margin-bottom: 18px;
  }

  &__status-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__rate-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 46px;
    margin-bottom: 10px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;

    & :deep(span) {
      padding-top: 1px;
    }
  }

  &__actions {
    display: flex;
    gap: 10px;
    margin-bottom: 18px;
  }

  &__action {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    cursor: pointer;
    transition: background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 8%,
        var(--fv-color-bg-secondary)
      );
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }

    &_fav {
      background: var(--fv-color-negative-soft);
      color: var(--fv-color-brand);

      &:hover {
        background: color-mix(in srgb, var(--fv-color-brand) 18%, transparent);
      }
    }

    &_on {
      background: var(--fv-color-accent-soft);
      color: var(--fv-color-accent);

      &:hover {
        background: color-mix(in srgb, var(--fv-color-accent) 20%, transparent);
      }
    }
  }

  &__actions :deep(.movie-share-btn) {
    flex: 1;
    min-width: 0;
    height: 44px;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 8px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    box-shadow: none;

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 8%,
        var(--fv-color-bg-secondary)
      );
      color: var(--fv-color-text-primary);
    }
  }

  &__footnote {
    margin: 0;
    padding-top: 12px;
    border-top: 1px solid var(--fv-color-border);
    font-size: 13px;
    line-height: 1.5;
    color: var(--fv-color-text-secondary);
  }
}

.similar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
}

.similar-card {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover .similar-card__poster {
    transform: translateY(-4px);
    box-shadow: var(--fv-shadow-middle);
  }

  &:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 3px;
    border-radius: 14px;
  }

  &__poster {
    display: block;
    aspect-ratio: 2 / 3;
    margin-bottom: 9px;
    border-radius: 14px;
    background: var(--fv-color-bg-secondary);
    overflow: hidden;
    transition: transform var(--fv-motion-base) var(--fv-ease),
      box-shadow var(--fv-motion-base) var(--fv-ease);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  &__title {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--fv-color-text-tertiary);
  }
}

/* Инфо-строки (эталон .mrow) — мобильная замена метастроки панели */
.detail-info {
  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 0;
    border-bottom: 1px solid var(--fv-color-border);

    &:first-child {
      padding-top: 0;
    }

    &:last-child {
      padding-bottom: 0;
      border-bottom: none;
    }
  }

  &__label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--fv-color-text-secondary);

    svg {
      color: var(--fv-color-accent);
    }
  }

  &__value {
    color: var(--fv-color-text-primary);
    text-align: right;
  }
}

.detail-hero {
  position: relative;
  display: flex;
  align-items: flex-end;
  height: min(420px, 56vh);
  padding: 20px;
  margin: 0 -1rem;
  overflow: hidden;

  &__bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;

    :deep(.movie-poster__caption) {
      display: none;
    }
    object-fit: cover;
  }

  &__scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(20, 26, 40, 0.35) 0%,
      rgba(20, 26, 40, 0.15) 35%,
      rgba(20, 26, 40, 0.92) 100%
    );
  }

  &__nav {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(4px);
    color: #fff;
    cursor: pointer;

    &_right {
      left: auto;
      right: 16px;
    }

    &_on {
      color: var(--fv-color-brand);
      background: rgba(255, 255, 255, 0.92);
    }
  }

  &__bottom {
    position: relative;
    z-index: 2;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
  }

  &__title {
    margin: 0;
    font-family: var(--fv-font-display);
    font-size: 30px;
    font-weight: 700;
    line-height: 1.05;
    color: #fff;
  }
}

/* Блок под hero: рейтинг, статус, быстрые действия */
.detail-mobile-bar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 0;
}

.detail-mobile-rate {
  display: flex;
  align-items: center;
  gap: 12px;

  &__num {
    font-family: var(--fv-font-display);
    font-size: 34px;
    font-weight: 700;
    line-height: 1;
    color: var(--fv-color-accent);
  }

  &__max {
    color: var(--fv-color-text-tertiary);
  }

  &__track {
    flex: 1;
    height: 8px;
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    overflow: hidden;
  }

  &__fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--fv-color-accent);
  }
}

.detail-mobile-status {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__label {
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }
}

.detail-mobile-actions {
  display: flex;
  gap: 10px;

  :deep(.movie-share-btn) {
    flex: 1;
    height: 48px;
    margin: 0;
    border: 1px solid var(--fv-color-border);
    border-radius: 8px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font-size: 15px;
    font-weight: 500;
    box-shadow: none;
  }

  &__icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 48px;
    border: 1px solid var(--fv-color-border);
    border-radius: 8px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    cursor: pointer;

    &_on {
      border-color: transparent;
      background: var(--fv-color-accent-soft);
      color: var(--fv-color-accent);
    }
  }
}

.detail-tabs {
  @include edgeContainer;
  display: flex;
  gap: 6px;
  padding: 6px 4px;
  margin-bottom: 14px;
  border-radius: 0;
  border-bottom: 1px solid var(--fv-color-border);
  background: var(--fv-color-bg-primary);
  position: sticky;
  top: var(--fv-topbar-height);
  z-index: 5;

  &__btn {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 44px;
    padding: 0 6px;
    border: none;
    border-radius: 9px;
    background: transparent;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
    transition: background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

    &--on {
      background: var(--fv-color-bg-active-soft);
      color: var(--fv-color-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: -2px;
    }
  }

  &__count {
    padding: 0 5px;
    border-radius: 999px;
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
    font-size: 11px;
    font-weight: 500;
  }
}

.detail-actionbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--fv-color-border);
  background: color-mix(in srgb, var(--fv-color-bg-primary) 94%, transparent);
  backdrop-filter: blur(10px);

  &__primary {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 48px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
  }

  &__icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }
  }
}

/* Жанры — чипами в блоке «Описание» (в панели эталона их нет) */
.detail-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;

  &__chip {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--fv-color-border);
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    font-size: 13px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }
}

.detail-section {
  @include detailSection;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;

    .detail-section__title {
      margin-bottom: 0;
    }
  }

  &__title {
    margin: 0 0 14px;
  }

  &__text {
    font-size: var(--fv-text-p3-size);
    line-height: var(--fv-text-p3-lh);
    color: var(--fv-color-text-secondary);
    margin: 0;
    white-space: pre-line;
  }
}

.movie-detail__review-widget {
  margin-top: 22px;
}

/* Мобильные переопределения — в конце файла, чтобы перебивать базовые правила */
@include mediaMax($tablet - 0.02px) {
  .movie-detail {
    padding-bottom: 0;
  }

  .movie-detail__content {
    padding-top: 0;
    padding-bottom: 96px;
  }

  .detail-crumbs,
  .detail-side {
    display: none;
  }

  .detail-info {
    font-size: 14px;
    line-height: 1.5;

    &__label svg {
      flex-shrink: 0;
    }

    &__value {
      font-weight: 600;
    }

    &__value--date {
      font-size: 13px;
      font-weight: 500;
    }
  }

  .detail-section--similar .detail-section__title {
    align-items: flex-start;
    font-size: 1.125rem;
    line-height: 1.35;

    svg {
      flex-shrink: 0;
    }
  }
}
</style>
