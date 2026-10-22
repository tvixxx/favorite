<script setup lang="ts">
import {
  blurAfterTouchSelect,
  selectPopupContainer,
} from "@/utils/touchSelect";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  Button as AButton,
  Select as ASelect,
  Spin as ASpin,
} from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import MoviePoster from "@/components/MoviePoster/MoviePoster.vue";
import { useMainStore } from "@/state/state";
import { fetchWatchTonight } from "@/services/watchTonight";
import type { MovieApiResponse } from "@/stores/movies/types";
import {
  GenreLabels,
  GenreValues,
} from "@/components/Genres/constants/genres.constants";
import { contentTypeLabel } from "@/utils/content-kind";
import { formatYear, pluralForm, pluralize, PLURAL } from "@/utils";
import { createRequestGuard } from "@/utils/requestGuard";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const main = useMainStore();
const router = useRouter();
const movies = ref<MovieApiResponse[]>([]);
const selected = ref<MovieApiResponse | null>(null);
const seen = ref(new Set<string>());
const kind = ref("any");
const genre = ref("any");
const loading = ref(false);
const loaded = ref(false);
const error = ref(false);
const guard = createRequestGuard();
let controller: AbortController | undefined;
const typeOptions = [
  { value: "any", label: "Любой тип" },
  { value: "film", label: "Фильм" },
  { value: "series", label: "Сериал" },
  { value: "ANIME", label: "Аниме" },
  { value: "ANIMATION", label: "Мультфильм" },
  { value: "TV_SHOW", label: "ТВ-шоу" },
];
const genreOptions = [
  { value: "any", label: "Любой жанр" },
  ...GenreValues.map((value) => ({ value, label: GenreLabels[value] })),
];
const filtered = computed(() =>
  movies.value.filter((movie) => {
    const type =
      !movie.contentKind || movie.contentKind === "GENERAL"
        ? movie.isSerial
          ? "series"
          : "film"
        : movie.contentKind;

    return (
      (kind.value === "any" || type === kind.value) &&
      (genre.value === "any" ||
        movie.genres.some(
          (value) => value.toUpperCase() === genre.value.toUpperCase()
        ))
    );
  })
);
const remaining = computed(() => filtered.value.length - seen.value.size);
const allShown = computed(
  () => filtered.value.length > 1 && remaining.value === 0
);
const meta = computed(() =>
  selected.value
    ? [
        selected.value.publishDate
          ? formatYear(selected.value.publishDate)
          : null,
        contentTypeLabel(selected.value),
      ]
        .filter(Boolean)
        .join(" · ")
    : ""
);
const genres = computed(
  () =>
    selected.value?.genres
      .map((value) => {
        const match = GenreValues.find(
          (genreValue) => genreValue.toUpperCase() === value.toUpperCase()
        );

        return match ? GenreLabels[match] : value;
      })
      .join(" · ") ?? ""
);

function choose(): void {
  const available = filtered.value.filter((movie) => !seen.value.has(movie.id));

  if (!available.length) return;

  const movie = available[Math.floor(Math.random() * available.length)];

  selected.value = movie;
  seen.value.add(movie.id);
}

function restart(): void {
  seen.value = new Set();
  selected.value = null;
  choose();
}

watch(filtered, restart);

function invalidate(): void {
  guard.invalidate();
  controller?.abort();
  movies.value = [];
  selected.value = null;
  seen.value = new Set();
  loaded.value = false;
  loading.value = false;
  error.value = false;
  kind.value = "any";
  genre.value = "any";
}

async function load(): Promise<void> {
  if (!main.userData?.id) return;
  controller?.abort();
  controller = new AbortController();

  const isCurrent = guard.begin();
  const id = main.userData.id;

  loading.value = true;
  error.value = false;
  loaded.value = false;
  movies.value = [];
  try {
    const result = await fetchWatchTonight(id, controller.signal);

    if (!isCurrent() || main.userData?.id !== id) return;
    movies.value = result;
    loaded.value = true;
  } catch {
    if (isCurrent()) error.value = true;
  } finally {
    if (isCurrent()) loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void load();
    else invalidate();
  },
  { immediate: true }
);

watch(
  () => [main.sessionRevision, main.userData?.id],
  () => {
    invalidate();
    emit("update:modelValue", false);
  },
  { flush: "sync" }
);

onBeforeUnmount(invalidate);
function resetFilters(): void {
  kind.value = "any";
  genre.value = "any";
}

function navigate(path: string): void {
  emit("update:modelValue", false);
  void router.push(path);
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    layout="form"
    class="watch-tonight"
    @update:model-value="emit('update:modelValue', $event ?? false)"
  >
    <template #title>Что посмотреть сегодня?</template>
    <template #body>
      <p class="watch-tonight__intro">
        Выбираем из ещё не начатого в «Буду смотреть».
      </p>
      <div v-if="loading" class="watch-tonight__state" role="status">
        <ASpin />
        <p>Загружаем список…</p>
      </div>
      <div v-else-if="error" class="watch-tonight__state" role="alert">
        <h3>Не удалось загрузить список</h3>
        <p>Проверьте соединение и попробуйте ещё раз.</p>
        <AButton @click="load">Повторить</AButton>
      </div>
      <div v-else-if="loaded && !movies.length" class="watch-tonight__state">
        <h3>Добавьте произведения на потом</h3>
        <p>
          Отмечайте интересное в каталоге как «Буду смотреть» — тогда здесь
          появятся варианты.
        </p>
        <AButton @click="navigate('/library/catalog')">Открыть каталог</AButton>
      </div>
      <template v-else-if="loaded">
        <div class="watch-tonight__filters">
          <div>
            <label for="watch-tonight-kind">Тип</label
            ><ASelect
              @select="blurAfterTouchSelect"
              :get-popup-container="selectPopupContainer"
              :list-height="160"
              v-model:value="kind"
              id="watch-tonight-kind"
              size="large"
              :options="typeOptions"
            />
          </div>
          <div>
            <label for="watch-tonight-genre">Жанр</label
            ><ASelect
              @select="blurAfterTouchSelect"
              :get-popup-container="selectPopupContainer"
              :list-height="160"
              v-model:value="genre"
              id="watch-tonight-genre"
              size="large"
              :options="genreOptions"
            />
          </div>
        </div>
        <template v-if="selected">
          <p class="watch-tonight__count">
            {{
              pluralForm(filtered.length, ["Подходит", "Подходят", "Подходят"])
            }}
            {{ pluralize(filtered.length, PLURAL.title) }}
          </p>
          <div class="watch-tonight__suggestion">
            <MoviePoster
              class="watch-tonight__poster"
              :src="selected.poster?.thumbnailUrl || selected.poster?.url"
              :seed="selected.id"
              :title="selected.title"
              :meta="meta"
              loading="eager"
            />
            <div class="watch-tonight__text">
              <h3>{{ selected.title }}</h3>
              <p class="watch-tonight__meta">{{ meta }}</p>
              <p class="watch-tonight__genres">{{ genres }}</p>
              <p class="watch-tonight__reason">
                <strong>Почему этот вариант</strong
                >{{
                  genre === "any"
                    ? "Вы отложили его на потом и ещё не начинали."
                    : "Он в «Буду смотреть», ещё не начат и подходит под выбранный жанр."
                }}
              </p>
            </div>
          </div>
          <p class="watch-tonight__availability" role="status">
            <template v-if="filtered.length === 1"
              >Это единственное подходящее произведение. Можно изменить
              фильтры.</template
            ><template v-else-if="allShown"
              >Все подходящие варианты показаны. Можно начать подбор
              заново.</template
            ><template v-else
              >Осталось ещё
              {{ pluralize(remaining, ["вариант", "варианта", "вариантов"]) }}
              без повторов.</template
            >
          </p>
        </template>
        <div v-else class="watch-tonight__state">
          <h3>Попробуйте другие фильтры</h3>
          <p>
            В «Буду смотреть» нет ещё не начатых произведений с таким типом и
            жанром.
          </p>
          <AButton @click="resetFilters">Сбросить фильтры</AButton>
        </div>
      </template>
    </template>
    <template #footer>
      <template v-if="selected && !loading && !error">
        <AButton
          :disabled="filtered.length === 1"
          @click="allShown ? restart() : choose()"
          >{{ allShown ? "Начать заново" : "Другой вариант" }}</AButton
        >
        <AButton type="primary" @click="navigate(`/detail/${selected.id}`)"
          >Открыть карточку</AButton
        >
      </template>
      <AButton v-else @click="emit('update:modelValue', false)"
        >Закрыть</AButton
      >
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.watch-tonight {
  font-family: var(--fv-font-ui);
  font-weight: var(--fv-weight-regular);

  &__intro,
  &__count,
  &__availability {
    color: var(--fv-color-text-secondary);
    font-size: var(--fv-text-p4-size);
    line-height: var(--fv-text-p4-lh);
  }

  &__meta,
  &__genres,
  &__reason,
  &__state p {
    font-size: var(--fv-text-p3-size);
    line-height: var(--fv-text-p3-lh);
  }

  &__meta,
  &__reason {
    color: var(--fv-color-text-secondary);
  }

  &__intro {
    margin: 0;
  }

  &__filters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 20px 0;
  }

  &__filters > div {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    font-size: var(--fv-text-p4-size);
    line-height: var(--fv-text-p4-lh);
    color: var(--fv-color-text-secondary);
  }

  &__filters :deep(.ant-select) {
    width: 100%;
  }

  &__count {
    margin: 0 0 14px;
  }

  &__suggestion {
    display: grid;
    grid-template-columns: 104px minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }

  &__poster {
    aspect-ratio: 2 / 3;
    height: auto;
    border-radius: 12px;
  }

  &__text {
    min-width: 0;
  }

  &__text h3 {
    font-size: var(--fv-text-h3-size);
    line-height: var(--fv-text-h3-lh);
    font-weight: var(--fv-weight-medium);
    margin: 0 0 var(--fv-space-12);
    overflow-wrap: anywhere;
  }

  &__meta {
    margin: 0 0 var(--fv-space-8);
  }

  &__genres {
    margin: 0 0 var(--fv-space-16);
  }

  &__reason {
    margin: 0;
  }

  &__reason strong {
    display: block;
    font-weight: var(--fv-weight-medium);
    color: var(--fv-color-text-primary);
    margin-bottom: var(--fv-space-8);
  }

  &__availability {
    margin: var(--fv-space-24) 0 0;
  }

  &__state {
    text-align: center;
    padding: var(--fv-space-24) 0 0;
  }

  &__state h3 {
    font-size: var(--fv-text-h4-size);
    line-height: var(--fv-text-h4-lh);
    font-weight: var(--fv-weight-medium);
    margin: 0 0 var(--fv-space-12);
  }

  &__state p {
    margin: 0 0 var(--fv-space-20);
    color: var(--fv-color-text-secondary);
  }

  &__state p:last-child {
    margin-bottom: 0;
  }

  @include mediaMax(400px) {
    &__filters {
      grid-template-columns: minmax(0, 1fr);
    }

    &__suggestion {
      grid-template-columns: 80px minmax(0, 1fr);
      gap: 14px;
    }

    &__text h3 {
      font-size: var(--fv-text-h4-size);
      line-height: var(--fv-text-h4-lh);
    }
  }
}
</style>

<style lang="scss">
@use "@/styles/media" as *;

.watch-tonight .modal__body {
  padding-bottom: var(--fv-space-24);
}

.watch-tonight .modal__footer {
  flex-wrap: wrap;
}

.watch-tonight .modal__footer > .ant-btn {
  flex: 1;
  min-width: 0;
}

@include mediaMax(480px) {
  .watch-tonight .modal__footer {
    flex-direction: column-reverse;
  }

  .watch-tonight .modal__footer > .ant-btn {
    flex: none;
    width: 100%;
    white-space: normal;
    height: auto;
    min-height: 44px;
  }
}
</style>
