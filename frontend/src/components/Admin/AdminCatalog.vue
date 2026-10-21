<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Alert as AAlert,
  Empty as AEmpty,
  Table as ATable,
} from "ant-design-vue";
import { useAdminPage } from "@/composable/useAdminPage";
import { useAdminQueryParam } from "@/composable/useAdminQueryParam";
import AdminDateFilters from "./AdminDateFilters.vue";
import AdminDataRegion from "./AdminDataRegion.vue";
import CatalogEditor from "./CatalogEditor.vue";
import { contentTypeLabel } from "@/utils/content-kind";
import CatalogQuality from "./CatalogQuality.vue";
import ConfirmDialog from "@/components/ConfirmDialog/ConfirmDialog.vue";
import api from "@/services/api";
import { message } from "ant-design-vue";
import { friendlyRequestError } from "@/utils/friendlyError";
import { type AdminMovie } from "./admin.types";
import { useDateTime } from "@/composable/useDateTime";

const { dateLabel } = useDateTime();
const q = useAdminQueryParam("movies_q", "", "movies_page");
const kind = useAdminQueryParam("movies_kind", "", "movies_page", [
  "",
  "film",
  "serial",
]);
const qualityFilter = useAdminQueryParam("movies_quality", "", "movies_page", [
  "",
  "poster",
  "date",
  "actors",
]);
const author = useAdminQueryParam("movies_author", "", "movies_page");
const from = useAdminQueryParam("movies_from", "", "movies_page");
const to = useAdminQueryParam("movies_to", "", "movies_page");
const sort = useAdminQueryParam("movies_sort", "", "movies_page", [
  "",
  "oldest",
]);
const { items, total, page, loading, error, quality, load } =
  useAdminPage<AdminMovie>(
    "/admin/movies",
    () => ({
      q: q.value,
      kind: kind.value,
      quality: qualityFilter.value,
      author: author.value,
      from: from.value,
      to: to.value,
      sort: sort.value,
    }),
    "movies_page"
  );
const editorOpen = ref(false);
const catalogRevision = ref(0);
const diagnosticFilters = computed(() => ({
  q: q.value,
  kind: kind.value,
  author: author.value,
  from: from.value,
  to: to.value,
}));
const movieId = ref<string | null>(null);
const removing = ref<AdminMovie | null>(null);
const deleting = ref(false);
const deleteOpen = computed({
  get: () => !!removing.value,
  set: (value: boolean) => {
    if (!value && !deleting.value) {
      removing.value = null;
    }
  },
});

function requestDelete(id: string): void {
  removing.value = items.value.find((item) => item.id === id) ?? null;
}

async function remove(): Promise<void> {
  if (!removing.value || deleting.value) {
    return;
  }

  deleting.value = true;

  try {
    await api.delete(`/movies/${removing.value.id}`);
    removing.value = null;
    catalogRevision.value += 1;
    await load(
      items.value.length === 1 && page.value > 1 ? page.value - 1 : page.value
    );

    message.success("Произведение удалено из общего каталога");
  } catch (err) {
    message.error(
      friendlyRequestError(err, { fallback: "Не удалось удалить произведение" })
    );
  } finally {
    deleting.value = false;
  }
}

const checks = [
  { key: "poster", label: "Без постера" },
  { key: "date", label: "Без даты" },
  { key: "actors", label: "Без актёров" },
];
const columns = [
  { title: "Название", key: "title" },
  { title: "Добавил", key: "author" },
  { title: "Дата", key: "date" },
  { title: "В коллекциях", key: "count" },
  { title: "", key: "actions" },
];

onMounted(() => void load());
function edit(id: string | null): void {
  movieId.value = id;
  editorOpen.value = true;
}

function saved(): void {
  catalogRevision.value += 1;
  void load();
}
</script>
<template>
  <section class="admin-panel">
    <div class="admin-toolbar">
      <div>
        <h2>Качество каталога</h2>
        <p class="admin-muted">
          Выберите проверку, чтобы увидеть карточки для доработки
        </p>
      </div>
      <a-button type="primary" @click="edit(null)"
        >Добавить произведение</a-button
      >
    </div>
    <div class="admin-quality">
      <button
        v-for="check in checks"
        :key="check.key"
        :class="{ 'is-selected': qualityFilter === check.key }"
        :aria-pressed="qualityFilter === check.key"
        @click="qualityFilter = qualityFilter === check.key ? '' : check.key"
      >
        <span>{{ check.label }}</span>
        <b>{{ quality[check.key] ?? 0 }}</b>
      </button>
    </div>
    <p class="admin-muted admin-caption">
      Отсутствие данных — повод проверить карточку. Тестовые произведения не
      удаляются.
    </p>
  </section>
  <CatalogQuality
    :filters="diagnosticFilters"
    :revision="catalogRevision"
    @edit="edit"
  />
  <section class="admin-panel">
    <div class="admin-toolbar">
      <h2>Каталог · {{ total }}</h2>
      <a-button v-if="qualityFilter" @click="qualityFilter = ''"
        >Сбросить проверку</a-button
      >
    </div>
    <div class="admin-filters">
      <a-input
        v-model:value="q"
        placeholder="Название"
        aria-label="Поиск произведений"
        class="admin-search"
        allow-clear
      />
      <a-select
        v-model:value="kind"
        aria-label="Тип произведения"
        :options="[
          { value: '', label: 'Все типы' },
          { value: 'film', label: 'Фильмы' },
          { value: 'serial', label: 'Сериалы' },
        ]"
      />
      <a-input
        v-model:value="author"
        aria-label="Поиск по автору произведения"
        placeholder="Имя автора произведения"
        allow-clear
        class="admin-search"
      />
    </div>
    <AdminDateFilters v-model:from="from" v-model:to="to" v-model:sort="sort" />
    <a-alert v-if="error" type="error" :message="error">
      <template #action>
        <a-button @click="load()">Повторить</a-button>
      </template>
    </a-alert>
    <AdminDataRegion v-if="!error || items.length" :loading="loading">
      <a-table
        class="admin-desktop"
        :columns="columns"
        :data-source="items"
        row-key="id"
        :locale="{ emptyText: 'Произведения не найдены' }"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <b>{{ record.title }}</b>
            <p class="admin-muted">
              {{ contentTypeLabel(record) }}
            </p>
          </template>
          <template v-else-if="column.key === 'author'">{{
            record.createdBy?.fullName ?? "Общий каталог"
          }}</template>
          <template v-else-if="column.key === 'date'">{{
            dateLabel(record.createdAt)
          }}</template>
          <template v-else-if="column.key === 'count'">{{
            record._count.userMovies
          }}</template>
          <template v-else-if="column.key === 'actions'">
            <a-button @click="edit(record.id)">Редактировать</a-button>
            <a-button type="text" danger @click="requestDelete(record.id)"
              >Удалить</a-button
            >
          </template>
        </template>
      </a-table>
      <div class="admin-mobile">
        <article v-for="movie in items" :key="movie.id" class="admin-row">
          <h3>{{ movie.title }}</h3>
          <p class="admin-muted">
            {{ contentTypeLabel(movie) }} ·
            {{ dateLabel(movie.createdAt) }}
          </p>
          <a-button @click="edit(movie.id)">Редактировать</a-button>
          <a-button type="text" danger @click="requestDelete(movie.id)"
            >Удалить</a-button
          >
        </article>
        <a-empty
          v-if="!items.length && !loading"
          description="Произведения не найдены"
        />
      </div>
    </AdminDataRegion>
    <a-pagination
      v-if="total > 20"
      :current="page"
      :total="total"
      :page-size="20"
      :show-size-changer="false"
      :disabled="loading"
      @change="load"
    />
  </section>
  <CatalogEditor v-model="editorOpen" :movie-id="movieId" @saved="saved" />
  <ConfirmDialog
    v-model="deleteOpen"
    :title="`Удалить «${removing?.title ?? ''}»?`"
    :description="`Это удалит произведение у всех пользователей. Связей с коллекциями: ${
      removing?._count.userMovies ?? 0
    }, списками: ${removing?._count.listItems ?? 0}, отзывов: ${
      removing?._count.reviews ?? 0
    }. Отменить удаление нельзя.`"
    confirm-text="Удалить у всех"
    :loading="deleting"
    @confirm="remove"
  />
</template>
