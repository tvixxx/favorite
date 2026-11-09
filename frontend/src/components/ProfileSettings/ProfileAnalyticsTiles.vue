<script setup lang="ts">
import { computed } from "vue";
import { GenreLabels } from "@/components/Genres/constants/genres.constants";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import type { UserMoviesAnalytics } from "@/stores/movies/types";

const props = defineProps<{ analytics?: UserMoviesAnalytics | null }>();
const movieShare = computed(() => {
  const { totalMovies = 0, totalSerials = 0 } = props.analytics ?? {};
  const total = totalMovies + totalSerials;

  return total ? (totalMovies / total) * 100 : 0;
});
const maxGenreCount = computed(() =>
  Math.max(1, ...(props.analytics?.topGenres.map(({ count }) => count) ?? []))
);
</script>

<template>
  <div class="profile-analytics-tiles" :aria-busy="!analytics || undefined">
    <section class="profile-analytics-tiles__tile">
      <h4>Коллекция</h4>
      <div v-if="analytics" class="profile-analytics-tiles__ratio">
        <span
          ><strong>{{ analytics.totalMovies }}</strong> Фильмы</span
        >
        <span
          ><strong>{{ analytics.totalSerials }}</strong> Сериалы</span
        >
      </div>
      <div
        v-else
        class="profile-analytics-tiles__ratio profile-analytics-tiles__line"
        aria-hidden="true"
      >
        <SkeletonBar width="74px" height="20px" radius="6px" />
        <SkeletonBar width="82px" height="20px" radius="6px" />
      </div>
      <div
        class="profile-analytics-tiles__track profile-analytics-tiles__track--ratio"
        aria-hidden="true"
      >
        <span v-if="analytics" :style="{ width: `${movieShare}%` }" />
        <SkeletonBar v-else height="100%" />
      </div>
      <p class="profile-analytics-tiles__hint">
        <template v-if="analytics"
          >Завершено {{ analytics.completionRate }}%</template
        >
        <SkeletonBar
          v-else
          width="92px"
          height="10px"
          radius="5px"
          aria-hidden="true"
        />
      </p>
    </section>
    <section class="profile-analytics-tiles__tile">
      <h4>Активность</h4>
      <ul class="profile-analytics-tiles__activity">
        <li>
          <span>За 7 дней</span>
          <strong v-if="analytics">{{ analytics.addedLast7Days }}</strong>
          <SkeletonBar
            v-else
            width="24px"
            height="20px"
            radius="5px"
            aria-hidden="true"
          />
        </li>
        <li>
          <span>За 30 дней</span>
          <strong v-if="analytics">{{ analytics.addedLast30Days }}</strong>
          <SkeletonBar
            v-else
            width="24px"
            height="20px"
            radius="5px"
            aria-hidden="true"
          />
        </li>
      </ul>
    </section>
    <section class="profile-analytics-tiles__tile">
      <h4>Топ жанров</h4>
      <ul
        v-if="analytics?.topGenres.length"
        class="profile-analytics-tiles__genres"
      >
        <li v-for="{ genre, count } in analytics.topGenres" :key="genre">
          <span>{{ GenreLabels[genre] ?? genre }}</span>
          <span class="profile-analytics-tiles__track" aria-hidden="true">
            <span :style="{ width: `${(count / maxGenreCount) * 100}%` }" />
          </span>
          <b>{{ count }}</b>
        </li>
      </ul>
      <ul
        v-else-if="!analytics"
        class="profile-analytics-tiles__genres"
        aria-hidden="true"
      >
        <li v-for="row in 3" :key="row">
          <SkeletonBar
            :width="row === 1 ? '74%' : '58%'"
            height="10px"
            radius="5px"
          />
          <SkeletonBar height="5px" />
          <SkeletonBar width="11px" height="10px" radius="4px" />
        </li>
      </ul>
      <p v-else class="profile-analytics-tiles__hint">
        Пока недостаточно данных
      </p>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.profile-analytics-tiles {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr);

  @include mediaTablet {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  &__tile {
    min-width: 0;
    container-type: inline-size;
    padding: clamp(14px, 2vw, 20px);
    background: var(--fv-color-bg-primary);
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-md);

    h4 {
      margin: 0 0 10px;
      font-size: 1.0625rem;
      line-height: 1.3;
    }

    strong {
      font-family: var(--fv-font-display);
      font-size: 1.6875rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.04em;
    }
  }

  &__ratio {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    min-height: 30px;
    margin-bottom: 10px;

    > span {
      min-width: 0;
      overflow-wrap: anywhere;
    }
  }

  &__line {
    align-items: center;
  }

  &__hint {
    margin: 8px 0 0;
    color: var(--fv-color-text-secondary);
    font-size: 0.8125rem;
    min-height: 20px;
    line-height: 20px;
    display: flex;
    align-items: center;
  }

  &__activity,
  &__genres {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__activity li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    padding: 9px 0;
    min-height: 45px;

    > strong,
    > .skel {
      margin-inline-start: auto;
      min-width: 0;
      text-align: end;
      overflow-wrap: anywhere;
    }

    & + li {
      min-height: 46px;
      border-top: 1px solid var(--fv-color-border);
    }
  }

  &__genres {
    display: grid;
    gap: 7px;

    li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) auto;
      align-items: center;
      gap: 8px;
      font-size: 0.8125rem;
      min-height: 20px;
      line-height: 20px;
      overflow-wrap: anywhere;
    }

    @container (max-width: 220px) {
      li {
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 8px;

        > :nth-child(2) {
          grid-column: 1 / -1;
          grid-row: 2;
        }
      }
    }
  }

  &__track {
    display: block;
    height: 5px;
    border-radius: 999px;
    background: var(--fv-color-border);
    overflow: hidden;

    &--ratio {
      height: 7px;
    }

    > span:not(.skel) {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--fv-color-accent);
    }
  }
}
</style>
