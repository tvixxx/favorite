<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Alert as AAlert,
  Empty as AEmpty,
  Table as ATable,
  Tag as ATag,
  message,
} from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import { useAdminPage } from "@/composable/useAdminPage";
import { useAdminQueryParam } from "@/composable/useAdminQueryParam";
import AdminDateFilters from "./AdminDateFilters.vue";
import AdminDataRegion from "./AdminDataRegion.vue";
import { useMainStore } from "@/state/state";
import api from "@/services/api";
import { friendlyRequestError } from "@/utils/friendlyError";
import { type AdminUser } from "./admin.types";
import {useDateTime} from '@/composable/useDateTime';
const {dateLabel}=useDateTime();

const q = useAdminQueryParam("users_q", "", "users_page");
const role = useAdminQueryParam("users_role", "", "users_page", [
  "",
  "USER",
  "ADMIN",
]);
const state = useAdminQueryParam("users_state", "", "users_page", [
  "",
  "active",
  "blocked",
]);
const from = useAdminQueryParam("users_from", "", "users_page");
const to = useAdminQueryParam("users_to", "", "users_page");
const sort = useAdminQueryParam("users_sort", "", "users_page", ["", "oldest"]);
const { items, total, page, loading, error, load } = useAdminPage<AdminUser>(
  "/admin/users",
  () => ({
    q: q.value,
    role: role.value,
    state: state.value,
    from: from.value,
    to: to.value,
    sort: sort.value,
  }),
  "users_page"
);
const selected = ref<AdminUser | null>(null);
const open = ref(false);
const reason = ref("");
const nextRole = ref<"USER" | "ADMIN">("USER");
const saving = ref(false);
const dialogOpen = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (!saving.value) {
      open.value = value;
    }
  },
});
const main = useMainStore();
const audit = ref<
  { id: string; action: string; reason: string; createdAt: string }[]
>([]);
const columns = [
  { title: "Пользователь", key: "name" },
  { title: "Регистрация", key: "date" },
  { title: "Коллекция", key: "count" },
  { title: "Доступ", key: "access" },
  { title: "", key: "actions" },
];

onMounted(() => void load());

async function show(id: string): Promise<void> {
  const user = items.value.find((item) => item.id === id);

  if (!user) {
    return;
  }

  selected.value = user;
  reason.value = "";
  nextRole.value = user.role;
  audit.value = [];
  open.value = true;

  try {
    const { data } = await api.get<typeof audit.value>(
      `/admin/audit/${user.id}`
    );

    if (selected.value?.id === user.id) {
      audit.value = data;
    }
  } catch {
    message.error("Журнал действий недоступен");
  }
}

async function changeAccess(action: "block" | "role" = "block"): Promise<void> {
  if (!selected.value || saving.value || reason.value.trim().length < 3) {
    return;
  }

  saving.value = true;

  try {
    await api.patch(`/admin/users/${selected.value.id}`, {
      ...(action === "role"
        ? { role: nextRole.value }
        : { blocked: !selected.value.blockedAt }),
      reason: reason.value.trim(),
    });
    open.value = false;
    message.success("Доступ обновлён");
    await load();
  } catch (err) {
    message.error(
      friendlyRequestError(err, { fallback: "Не удалось изменить доступ" })
    );
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="admin-panel">
    <div class="admin-toolbar">
      <h2>
        Пользователи <span class="admin-muted">{{ total }}</span>
      </h2>
    </div>
    <div class="admin-filters">
      <a-input
        v-model:value="q"
        aria-label="Поиск пользователей"
        placeholder="Имя или email"
        allow-clear
        class="admin-search"
      />
      <a-select
        v-model:value="role"
        aria-label="Фильтр роли"
        :options="[
          { value: '', label: 'Все роли' },
          { value: 'USER', label: 'Пользователи' },
          { value: 'ADMIN', label: 'Администраторы' },
        ]"
      />
      <a-select
        v-model:value="state"
        aria-label="Фильтр доступа"
        :options="[
          { value: '', label: 'Любой доступ' },
          { value: 'active', label: 'Доступ разрешён' },
          { value: 'blocked', label: 'Заблокированы' },
        ]"
      />
    </div>
    <AdminDateFilters v-model:from="from" v-model:to="to" v-model:sort="sort" />
    <a-alert v-if="error" type="error" :message="error" show-icon>
      <template #action>
        <a-button @click="load()">Повторить</a-button>
      </template>
    </a-alert>
    <AdminDataRegion v-if="!error || items.length" :loading="loading">
      <a-table
        class="admin-desktop"
        :data-source="items"
        :columns="columns"
        row-key="id"
        :locale="{ emptyText: 'Пользователи не найдены' }"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <b>{{ record.fullName }}</b>
            <div class="admin-muted">{{ record.email }}</div>
          </template>
          <template v-else-if="column.key === 'date'">{{
            dateLabel(record.createdAt)
          }}</template>
          <template v-else-if="column.key === 'count'">{{
            record._count.userMovies
          }}</template>
          <template v-else-if="column.key === 'access'">
            <a-tag :color="record.blockedAt ? 'orange' : 'blue'">{{
              record.blockedAt ? "Ограничен" : record.role
            }}</a-tag>
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-button @click="show(record.id)">Открыть</a-button>
          </template>
        </template>
      </a-table>
      <div class="admin-mobile">
        <article v-for="user in items" :key="user.id" class="admin-row">
          <b>{{ user.fullName }}</b>
          <p class="admin-muted">{{ user.email }}</p>
          <p>
            {{ dateLabel(user.createdAt) }} · {{ user._count.userMovies }} в
            коллекции
          </p>
          <a-button @click="show(user.id)">Открыть пользователя</a-button>
        </article>
        <a-empty
          v-if="!items.length && !loading"
          description="Пользователи не найдены"
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
  <BaseModal v-model="dialogOpen" layout="form" class="admin-dialog">
    <template #title>{{ selected?.fullName }}</template>
    <template #body>
      <template v-if="selected">
        <dl class="admin-facts">
          <dt>Email</dt>
          <dd>{{ selected.email }}</dd>
          <dt>Регистрация</dt>
          <dd>{{ dateLabel(selected.createdAt) }}</dd>
          <dt>Роль</dt>
          <dd>{{ selected.role }}</dd>
          <dt>Коллекция / отзывы</dt>
          <dd>
            {{ selected._count.userMovies }} / {{ selected._count.reviews }}
          </dd>
          <dt>Доступ</dt>
          <dd>{{ selected.blockedAt ? "Ограничен" : "Разрешён" }}</dd>
        </dl>
        <p v-if="selected.blockedReason">
          Причина: {{ selected.blockedReason }}
        </p>
        <template v-if="selected.id !== main.userData?.id">
          <label class="admin-label" for="user-role">Роль пользователя</label>
          <a-select
            id="user-role"
            v-model:value="nextRole"
            :disabled="saving"
            :options="[
              { value: 'USER', label: 'Пользователь' },
              { value: 'ADMIN', label: 'Администратор' },
            ]"
            style="width: 100%"
          />
          <p v-if="nextRole !== selected.role" class="admin-muted">
            После подтверждения роль изменится: {{ selected.role }} →
            {{ nextRole }}.
          </p>
          <label class="admin-label" for="access-reason"
            >Причина изменения доступа</label
          >
          <a-textarea
            id="access-reason"
            v-model:value="reason"
            :maxlength="500"
            :rows="3"
            placeholder="Не менее 3 символов"
            :disabled="saving"
          />
          <p class="admin-muted">
            Блокировка запрещает вход и отключает чат. Данные пользователя
            сохраняются.
          </p>
        </template>
        <h3>Последние решения</h3>
        <p v-if="!audit.length" class="admin-muted">Решений пока нет</p>
        <div v-for="entry in audit" :key="entry.id" class="admin-row">
          <b>{{ dateLabel(entry.createdAt) }}</b>
          <p>{{ entry.reason }}</p>
        </div>
      </template>
    </template>
    <template #footer>
      <a-button
        v-if="
          selected &&
          selected.id !== main.userData?.id &&
          nextRole !== selected.role
        "
        :disabled="saving || reason.trim().length < 3"
        @click="changeAccess('role')"
        >Подтвердить смену роли</a-button
      >
      <a-button :disabled="saving" @click="open = false">Закрыть</a-button>
      <a-button
        v-if="selected && selected.id !== main.userData?.id"
        type="primary"
        :danger="!selected.blockedAt"
        :disabled="reason.trim().length < 3"
        :loading="saving"
        @click="changeAccess('block')"
        >{{
          selected.blockedAt ? "Восстановить доступ" : "Ограничить доступ"
        }}</a-button
      >
    </template>
  </BaseModal>
</template>
