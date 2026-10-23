<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, useId } from "vue";
import { Button, Tag } from "ant-design-vue";
import api from "@/services/api";
import { friendlyRequestError } from "@/utils/friendlyError";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import NotificationPager from "@/components/Notifications/NotificationPager.vue";
import AnnouncementEditor, {
  type AnnouncementDraft,
} from "./AnnouncementEditor.vue";
import { safeNotificationActions } from "@/components/Notifications/notification-actions";
import type { NotificationAction } from "@/components/Notifications/center.types";
interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  category: "NEWS" | "SERVICE" | "RELEASE";
  actions: NotificationAction[];
  publishedAt: string | null;
  archivedAt: string | null;
}

const editorFormId = useId();
const items = ref<AdminAnnouncement[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const error = ref("");
const saving = ref(false);
const editing = ref<AnnouncementDraft | null>(null);
const confirming = ref<AdminAnnouncement | null>(null);
const operation = ref<"publish" | "archive">("publish");
let request: AbortController | undefined;
const editorOpen = computed({
  get: () => !!editing.value,
  set: (value: boolean) => {
    if (!value && !saving.value) editing.value = null;
  },
});
const confirmOpen = computed({
  get: () => !!confirming.value,
  set: (value: boolean) => {
    if (!value && !saving.value) confirming.value = null;
  },
});

async function load(): Promise<void> {
  request?.abort();

  const current = (request = new AbortController());

  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get<{
      items: AdminAnnouncement[];
      total: number;
    }>("/admin/announcements", {
      params: { limit: 20, offset: (page.value - 1) * 20 },
      signal: current.signal,
    });

    if (!current.signal.aborted) {
      items.value = data.items;
      total.value = data.total;
    }
  } catch (cause) {
    if (!current.signal.aborted)
      error.value = friendlyRequestError(cause, {
        fallback: "Не удалось загрузить объявления.",
      });
  } finally {
    if (!current.signal.aborted) loading.value = false;
  }
}

function edit(item?: AdminAnnouncement): void {
  editing.value = item
    ? {
        id: item.id,
        title: item.title,
        body: item.body,
        category: item.category === "SERVICE" ? "SERVICE" : "NEWS",
        actions: safeNotificationActions(item.actions),
      }
    : { title: "", body: "", category: "NEWS", actions: [] };
}

async function save(draft: AnnouncementDraft): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    const { id, ...data } = draft;

    if (id) await api.patch("/admin/announcements/" + id, data);
    else await api.post("/admin/announcements", data);
    editing.value = null;
    await load();
  } catch (cause) {
    error.value = friendlyRequestError(cause, {
      fallback: "Не удалось сохранить черновик.",
    });
  } finally {
    saving.value = false;
  }
}

async function apply(): Promise<void> {
  if (!confirming.value || saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    await api.post(
      "/admin/announcements/" + confirming.value.id + "/" + operation.value
    );

    confirming.value = null;
    await load();
  } catch (cause) {
    error.value = friendlyRequestError(cause, {
      fallback: "Не удалось изменить объявление.",
    });
  } finally {
    saving.value = false;
  }
}

watch(page, () => void load(), { immediate: true });
onBeforeUnmount(() => request?.abort());
</script>
<template>
  <section class="admin-panel">
    <div class="admin-toolbar">
      <h2>Системные объявления</h2>
      <Button type="primary" @click="edit()">Создать объявление</Button>
    </div>
    <p class="admin-muted">
      Черновик виден только администраторам. Опубликованное объявление доступно
      всем пользователям, включая тех, кто войдёт позже. Изменить опубликованный
      текст нельзя, его можно архивировать.
    </p>
    <StateBlock
      v-if="error"
      variant="error"
      :title="error"
      :actions="[{ label: 'Повторить', onClick: load }]"
    />
    <p v-if="loading && !items.length" role="status">Загружаем объявления…</p>
    <article v-for="item in items" :key="item.id" class="announcement-row">
      <div>
        <h3>{{ item.title }}</h3>
        <Tag>{{
          item.archivedAt
            ? "В архиве"
            : item.publishedAt
            ? "Опубликовано"
            : "Черновик"
        }}</Tag
        ><Tag>{{
          item.category === "RELEASE"
            ? "Релиз"
            : item.category === "NEWS"
            ? "Новости"
            : "Работа сервиса"
        }}</Tag>
      </div>
      <p>{{ item.body }}</p>
      <div class="announcement-row__actions">
        <Button
          v-if="!item.publishedAt && !item.archivedAt"
          :disabled="loading || saving"
          @click="edit(item)"
          >Редактировать</Button
        ><Button
          v-if="!item.publishedAt && !item.archivedAt"
          :disabled="loading || saving"
          @click="
            confirming = item;
            operation = 'publish';
          "
          >Предпросмотр и публикация</Button
        ><Button
          v-if="!item.archivedAt"
          :disabled="loading || saving"
          @click="
            confirming = item;
            operation = 'archive';
          "
          >В архив</Button
        >
      </div>
    </article>
    <p v-if="!loading && !error && !items.length" class="admin-muted">
      Объявлений пока нет. Создайте первый черновик.
    </p>
    <NotificationPager
      :current="page"
      :total="total"
      :page-size="20"
      label="объявлений"
      :disabled="loading || saving"
      @change="page = $event"
    />
    <BaseModal v-model="editorOpen"
      ><template #title>{{
        editing?.id ? "Редактировать черновик" : "Новое объявление"
      }}</template
      ><template #body
        ><AnnouncementEditor
          v-if="editing"
          :value="editing"
          :saving="saving"
          :form-id="editorFormId"
          @save="save"
        />
        <p v-if="error" role="alert">{{ error }}</p></template
      >
      <template #footer>
        <Button :disabled="saving" @click="editing = null">Отмена</Button>
        <Button
          :form="editorFormId"
          html-type="submit"
          data-intent="preview"
          :disabled="saving"
          >Предпросмотр</Button
        >
        <Button
          :form="editorFormId"
          html-type="submit"
          data-intent="save"
          type="primary"
          :loading="saving"
          >Сохранить черновик</Button
        >
      </template>
    </BaseModal>
    <BaseModal v-model="confirmOpen"
      ><template #title>{{
        operation === "publish"
          ? "Опубликовать для всех?"
          : "Архивировать объявление?"
      }}</template
      ><template #body
        ><h3>{{ confirming?.title }}</h3>
        <p class="announcement-row__full">{{ confirming?.body }}</p>
        <Button
          v-for="action in safeNotificationActions(confirming?.actions)"
          :key="action.path"
          disabled
          >{{ action.label }}</Button
        >
        <p class="admin-muted">
          {{
            operation === "publish"
              ? "Объявление появится в системных уведомлениях всех пользователей."
              : "Объявление перестанет показываться пользователям. Запись останется в админке."
          }}
        </p>
        <p v-if="error" role="alert">{{ error }}</p></template
      ><template #footer
        ><Button :disabled="saving" @click="confirming = null">Отмена</Button
        ><Button type="primary" :loading="saving" @click="apply">{{
          operation === "publish" ? "Опубликовать для всех" : "Архивировать"
        }}</Button></template
      ></BaseModal
    >
  </section>
</template>
<style scoped lang="scss">
.announcement-row {
  padding: 20px 0;
  border-bottom: 1px solid var(--fv-color-border);
  h3 {
    display: inline;
    margin-right: 10px;
    overflow-wrap: anywhere;
  }
  > p {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--fv-color-text-secondary);
    font-size: 14px;
  }
  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  &__full {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 14px;
  }
}
</style>
