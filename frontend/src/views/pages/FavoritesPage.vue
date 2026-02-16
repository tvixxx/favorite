<script lang="ts" setup>
import { useRouter } from "vue-router";
import { computed, onMounted, ref } from "vue";
import { formatDate, formatYear } from "@/utils";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { useMainStore } from "@/state/state";
import { message } from "ant-design-vue";
import { useFavoritesStore } from "@/stores/favorites/favoritesStore";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import ListError from "@/components/ListError/ListError.vue";
import ListLoading from "@/components/ListLoading/ListLoading.vue";
import ListEmpty from "@/components/ListEmpty/ListEmpty.vue";
import type { Movie } from "@/stores";

const router = useRouter();
const favoritesStore = useFavoritesStore();
const mainStore = useMainStore();

const imageErrors = ref<Set<string>>(new Set());

const hasFavorites = computed(() => favoritesStore.favoritesList.length !== 0);
const totalFavorites = computed(() => favoritesStore.favoritesList.length);
const shouldFetchFavorites = computed(
  () => !hasFavorites.value && mainStore.isLoggedIn
);
const showPaginator = computed(
  () =>
    !!favoritesStore.favoritesList.length &&
    !favoritesStore.isError &&
    !favoritesStore.isLoading
);

const getPosterSrc = (item: Movie) => {
  return imageErrors.value.has(item.id)
    ? FALLBACK_IMAGE_URL
    : item.imageUrl || FALLBACK_IMAGE_URL;
};

onMounted(async () => {
  if (shouldFetchFavorites.value) {
    await favoritesStore.fetchFavorites();
  }
});

const handleImageError = (movieId: string) => {
  imageErrors.value.add(movieId);
};

const removeFromFavorite = async (favoriteMovie: Movie) => {
  try {
    await favoritesStore.removeFromFavorite(favoriteMovie);
    message.success(`${favoriteMovie.title} удален`);
  } catch {
    message.error(`Не удалось убрать из избранного: ${favoriteMovie.title}`);
  }
};

const goToMovie = ({ id }: Movie) => {
  router.push(`/detail/${id}`);
};

const goToMovies = () => {
  router.push("/list");
};
</script>

<template>
  <section class="favorites">
    <HeroHeader
      title="Ваши любимые фильмы"
      subtitle="Только то, что вы выделили как лучшее"
      badge-text="Избранное"
      :badge-count="totalFavorites"
      icon-name="mdi:heart"
    />

    <div class="favorites__content">
      <ListError
        v-if="favoritesStore.isError"
        :isError="favoritesStore.isError"
        :repeatFn="favoritesStore.fetchFavorites"
        repeatText="Повторить"
      />

      <div v-else-if="favoritesStore.isLoading" class="favorites__loading">
        <ListLoading
          size="large"
          loading-text="Загружаем избранное..."
          :center="true"
        />
      </div>

      <div v-else-if="!hasFavorites" class="favorites__empty-state">
        <ListEmpty
          description="Избранных фильмов пока нет..."
          btn-text="Перейти в фильмы"
          :btn-handler="goToMovies"
        />
      </div>

      <div v-else class="favorites__section">
        <div class="favorites__section-header">
          <h2 class="favorites__section-title">
            <BaseIcon name="mdi:heart-outline" />
            Избранное
          </h2>
          <a-button
            size="large"
            @click="favoritesStore.fetchFavorites"
            class="favorites__refresh"
          >
            Обновить
          </a-button>
        </div>

        <div class="favorites__grid">
          <div
            v-for="item in favoritesStore.paginatedFavorites"
            :key="item.id"
            class="favorites__card"
            @click="goToMovie(item)"
          >
            <div class="favorites__card-image">
              <img
                :src="getPosterSrc(item)"
                :alt="`${item.title} постер`"
                class="favorites__poster"
                loading="lazy"
                @error="handleImageError(item.id)"
              />
              <div class="favorites__card-favorite">
                <BaseIcon name="mdi:heart" />
              </div>
            </div>

            <div class="favorites__card-content">
              <div class="favorites__card-rating">{{ item.rate }}/10</div>

              <button
                class="favorites__card-delete"
                @click.stop="() => removeFromFavorite(item)"
              >
                <BaseIcon name="pajamas:remove" />
              </button>

              <h3 class="favorites__card-title">{{ item.title }}</h3>

              <div class="favorites__card-meta">
                <div class="favorites__meta-item">
                  <BaseIcon name="mdi:calendar" class="favorites__meta-icon" />
                  {{ formatDate(item.date) }}
                </div>
                <div class="favorites__meta-item">
                  {{ formatYear(item.publishDate) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="favorites__pagination" v-if="showPaginator">
          <a-pagination
            v-model:current="favoritesStore.currentPage"
            :total="totalFavorites"
            :page-size="favoritesStore.pageSize"
            :page-size-options="['6', '12', '18', '24']"
            show-size-changer
            @change="favoritesStore.setCurrentPage"
            @showSizeChange="(_, size: number) => favoritesStore.setPageSize(size)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../../styles/screen-sizes" as *;
@use "../../styles/media" as *;

.favorites {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    var(--bg-primary) 0%,
    var(--bg-secondary) 100%
  );
  color: var(--text-primary);
  padding: 0 0 4rem 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;

  &__content {
    max-width: 1400px;
    margin: auto;
    padding: 0 1rem;
  }
  &__section {
    margin-top: 2rem;
  }

  &__section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid
      color-mix(in srgb, var(--border-color) 50%, transparent);
  }

  &__section-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0;

    svg {
      width: 28px;
      height: 28px;
      color: var(--ant-color-primary);
    }
  }

  &__refresh {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);

    &:hover {
      border-color: var(--ant-color-primary);
      color: var(--ant-color-primary);
    }
  }

  &__grid {
    display: grid;
    gap: 2.5rem;
    margin: 2rem 0;
    justify-content: center;
    max-width: 1800px;

    @media (min-width: 1900px) {
      grid-template-columns: repeat(4, 430px);
    }
    @media (min-width: 1600px) {
      grid-template-columns: repeat(4, 380px);
    }
    @media (min-width: 1200px) and (max-width: 1680px) {
      grid-template-columns: repeat(3, minmax(380px, 430px));
    }
    @media (min-width: 900px) and (max-width: 1199px) {
      grid-template-columns: repeat(2, 430px);
    }
    @media (max-width: 899px) {
      grid-template-columns: minmax(350px, 430px);
      gap: 2rem;
    }
    @media (max-width: 500px) {
      grid-template-columns: 1fr;
      gap: 1.5rem;
      padding: 0 1rem;
    }
  }

  &__card {
    background: var(--bg-primary);
    border-radius: 20px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    height: 480px;
    border: 1px solid color-mix(in srgb, var(--border-color) 50%, transparent);
    box-shadow: var(--shadow);

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(
        90deg,
        var(--ant-color-primary),
        color-mix(in srgb, var(--ant-color-primary) 50%, var(--bg-secondary))
      );
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border-color: var(--ant-color-primary);

      &::before {
        opacity: 1;
      }
      .favorites__poster {
        transform: scale(1.05);
      }
    }
  }

  &__card-image {
    position: relative;
    height: 240px;
    overflow: hidden;
    background: linear-gradient(135deg, var(--bg-secondary), var(--bg-primary));
  }

  &__poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    transition: transform 0.4s ease;
  }

  &__card-favorite {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);

    svg {
      width: 22px;
      height: 22px;
      color: var(--ant-color-primary);
    }
  }

  &__card-content {
    padding: 1.5rem;
    height: calc(100% - 240px);
    display: flex;
    flex-direction: column;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 100%, transparent) 0%,
      color-mix(in srgb, var(--bg-secondary) 100%, transparent) 100%
    );
    position: relative;
    gap: 0.5rem;
  }

  &__card-rating {
    align-self: flex-end;
    background: var(--ant-color-primary);
    color: white;
    padding: 0.375rem 0.875rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 700;
    box-shadow: 0 4px 16px
      color-mix(in srgb, var(--ant-color-primary) 30%, transparent);
  }

  &__card-delete {
    position: absolute;
    top: 1rem;
    left: 1rem;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--bg-secondary) 85%, transparent);
    border: 2px solid color-mix(in srgb, var(--text-secondary) 70%, transparent);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(12px);
    opacity: 0.9;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

    @media (min-width: 900px) {
      opacity: 0;
      .favorites__card:hover & {
        opacity: 1;
      }
    }

    &:hover {
      background: #ef4444;
      border-color: #dc2626;
      color: white;
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    }

    svg {
      width: 18px;
      height: 18px;
    }
  }

  &__card-title {
    font-size: clamp(1rem, 2vw, 1.25rem); // ✅ МЕНЬШЕ!
    font-weight: 700;
    margin: 0;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: var(--text-primary);
    flex-grow: 1;
  }

  &__card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: auto;
    padding-top: 0.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 40%, transparent);
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  &__meta-icon {
    width: 16px;
    height: 16px;
    color: var(--ant-color-primary);
  }

  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    padding: 2rem;
    width: 100%;
  }

  &__pagination {
    display: flex;
    justify-content: center;
    margin-top: 4rem;
    padding: 2rem 0;
  }

  &__empty-state {
    min-height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-secondary);
  }
}
</style>
