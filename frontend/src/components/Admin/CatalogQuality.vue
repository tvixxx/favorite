<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import {
  Alert as AAlert,
  Checkbox as ACheckbox,
  Empty as AEmpty,
  Pagination as APagination,
  Progress as AProgress,
  Select as ASelect,
  Tag as ATag,
} from "ant-design-vue";
import { useCatalogQuality } from "@/composable/useCatalogQuality";
import { contentTypeLabel } from "@/utils/content-kind";
import { catalogIssueLabels, type CatalogIssue } from "@/utils/catalogQuality";
import {useDateTime} from '@/composable/useDateTime';
const {formatInstant,timezone}=useDateTime();

const props = defineProps<{
  filters: Record<string, string>;
  revision: number;
}>();
const emit = defineEmits<{ edit: [id: string] }>();
const { status, findings, progress, error, checkedAt, run, cancel, reset } =
  useCatalogQuality(() => props.filters);
const checkPosters = shallowRef(true);
const checkedPosters = shallowRef(false);
const issue = shallowRef<"" | CatalogIssue>("");
const page = shallowRef(1);
const filtered = computed(() => {
  const selected = issue.value;

  return selected
    ? findings.value.filter((row) => row.issues.includes(selected))
    : findings.value;
});
const visible = computed(() =>
  filtered.value.slice((page.value - 1) * 20, page.value * 20)
);
const options = computed(() => [
  { value: "", label: `Все замечания · ${findings.value.length}` },
  ...Object.entries(catalogIssueLabels).map(([value, label]) => ({
    value,
    label: `${label} · ${
      findings.value.filter((row) => row.issues.includes(value as CatalogIssue))
        .length
    }`,
  })),
]);
const percent = computed(() =>
  status.value === "done"
    ? 100
    : progress.value.total
    ? Math.round(
        (progress.value.loaded / progress.value.total) *
          (checkedPosters.value ? 50 : 100) +
          (progress.value.posterTotal
            ? (progress.value.posters / progress.value.posterTotal) * 50
            : 0)
      )
    : 0
);
function start(): void {
  checkedPosters.value = checkPosters.value;
  issue.value = "";
  void run(checkPosters.value);
}

watch([issue, findings], () => {
  page.value = 1;
});
watch(() => props.revision, reset);
</script>

<template>
  <section class="admin-panel catalog-quality">
    <div class="admin-toolbar">
      <div>
        <h2>Диагностика каталога</h2>
        <p class="admin-muted">
          Поиск похожих записей и неполных данных по выбранным ниже названию,
          типу, автору и периоду.
        </p>
      </div>
      <a-button v-if="status === 'running'" @click="cancel"
        >Остановить</a-button
      >
      <a-button v-else type="primary" @click="start"
        >Проверить каталог</a-button
      >
    </div>
    <a-checkbox v-model:checked="checkPosters" :disabled="status === 'running'"
      >Проверить внешние постеры</a-checkbox
    >
    <p class="admin-muted admin-caption">
      Постеры проверяются в этом браузере. Ошибка загрузки может быть связана с
      сетью или ограничениями сайта изображений. Данные не изменяются, возможные
      дубли требуют ручного сравнения.
    </p>
    <div
      v-if="status === 'running'"
      class="catalog-quality__progress"
      aria-live="polite"
    >
      <a-progress :percent="percent" :show-info="false" />
      <p>
        Загружено карточек: {{ progress.loaded }} / {{ progress.total }}.
        Проверено адресов постеров: {{ progress.posters }} /
        {{ progress.posterTotal }}.
      </p>
    </div>
    <a-alert
      v-if="status === 'error'"
      type="error"
      :message="error"
      show-icon
    />
    <a-alert
      v-if="status === 'cancelled'"
      type="info"
      message="Проверка остановлена. Неполный результат не показан."
      show-icon
    />
    <template v-if="status === 'done'">
      <p class="admin-caption" aria-live="polite">
        Проверено {{ progress.loaded }} карточек ·
        {{ formatInstant(checkedAt??null) }} ({{timezone}}). С замечаниями:
        {{ findings.length }}.
      </p>
      <p v-if="!checkedPosters" class="admin-muted">
        Доступность внешних постеров не проверялась.
      </p>
      <a-select
        v-model:value="issue"
        :options="options"
        aria-label="Тип замечания каталога"
        class="catalog-quality__select"
      />
      <a-empty
        v-if="!filtered.length"
        description="Замечаний по этой проверке не найдено"
      />
      <ul v-else class="catalog-quality__list">
        <li
          v-for="movie in visible"
          :key="movie.id"
          class="catalog-quality__item"
        >
          <div class="catalog-quality__content">
            <h3>{{ movie.title }}</h3>
            <p class="admin-muted">
              {{ contentTypeLabel(movie) }} ·
              {{ movie.year ?? "Год не указан" }}
            </p>
            <div class="catalog-quality__tags">
              <a-tag v-for="key in movie.issues" :key="key">{{
                catalogIssueLabels[key]
              }}</a-tag>
            </div>
            <div
              v-if="movie.duplicates.length"
              class="catalog-quality__duplicates"
            >
              <span class="admin-muted">Сравнить:</span>
              <a-button
                v-for="other in movie.duplicates"
                :key="other.id"
                type="link"
                @click="emit('edit', other.id)"
                >{{ other.title }} · {{ other.year ?? "Без года" }}</a-button
              >
              <span
                v-if="movie.duplicateCount > movie.duplicates.length"
                class="admin-muted"
                >И ещё
                {{ movie.duplicateCount - movie.duplicates.length }}.</span
              >
            </div>
          </div>
          <a-button @click="emit('edit', movie.id)">Редактировать</a-button>
        </li>
      </ul>
      <a-pagination
        v-if="filtered.length > 20"
        v-model:current="page"
        :total="filtered.length"
        :page-size="20"
        :show-size-changer="false"
      />
    </template>
  </section>
</template>

<style scoped lang="scss">
.catalog-quality__select {
  width: 100%;
  margin: 16px 0;
}
.catalog-quality__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.catalog-quality__item {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  gap: 16px;
  border-top: 1px solid var(--fv-color-border);
  padding: 20px 0;
}
.catalog-quality__content {
  flex: 1 1 240px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.catalog-quality__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.catalog-quality__duplicates {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
}
.catalog-quality__duplicates :deep(.ant-btn) {
  max-width: 100%;
  height: auto;
  white-space: normal;
  text-align: left;
  overflow-wrap: anywhere;
}
</style>
