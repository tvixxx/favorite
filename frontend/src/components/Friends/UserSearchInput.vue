<script setup lang="ts">
import { ref, watch } from "vue";
import api from "@/services/api";
import { blurAfterTouchSelect } from "@/utils/touchSelect";
import type { FriendUser } from "@/stores/friends/friendsStore";

type FoundUser = Pick<FriendUser, "id" | "fullName" | "username">;

const selected = defineModel<FoundUser | null>({ default: null });
const props = defineProps<{ disabled?: boolean }>();
const query = ref("");
const users = ref<FoundUser[]>([]);
const loading = ref(false);
const error = ref("");
const searched = ref(false);

watch(query, (value, _previous, cleanup) => {
  selected.value = null;
  users.value = [];
  error.value = "";
  searched.value = false;
  loading.value = false;

  const term = value.trim();

  if (term.length < 2) return;

  const controller = new AbortController();

  loading.value = true;

  const timer = setTimeout(async () => {
    try {
      const { data } = await api.get<FoundUser[]>("/users/search", {
        params: { query: term },
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        users.value = data;
        searched.value = true;
      }
    } catch {
      if (!controller.signal.aborted)
        error.value =
          "Не удалось найти пользователей. Попробуйте изменить запрос.";
    } finally {
      if (!controller.signal.aborted) loading.value = false;
    }
  }, 250);

  cleanup(() => {
    clearTimeout(timer);
    controller.abort();
  });
});
</script>

<template>
  <div class="user-search">
    <label>
      <span>Найти человека</span>
      <input
        v-model="query"
        class="fv-native-field"
        :disabled="props.disabled"
        maxlength="100"
        type="search"
        autocomplete="off"
        autocapitalize="none"
        :spellcheck="false"
        placeholder="Имя, ник или почта"
        aria-describedby="friend-search-help"
      />
    </label>
    <p id="friend-search-help">
      Введите хотя бы два символа и выберите человека. Уникальный ник можно
      задать в настройках профиля. При одинаковых именах уточните ник или почту
      у друга.
    </p>
    <p v-if="loading" role="status">Ищем…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="searched && !users.length">
      Никого не нашли. Проверьте написание имени, ника или почты.
    </p>
    <ul v-else-if="users.length">
      <li v-for="user in users" :key="user.id">
        <button
          type="button"
          :disabled="props.disabled"
          :aria-pressed="selected?.id === user.id"
          @click="
            selected = user;
            blurAfterTouchSelect();
          "
        >
          <strong>{{ user.fullName }}</strong>
          <span v-if="user.username">{{ user.username }}</span>
          <span v-if="selected?.id === user.id">Выбран</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.user-search {
  min-width: 0;
  label {
    display: grid;
    gap: 8px;
  }
  p {
    margin: 8px 0;
    color: var(--fv-color-text-secondary);
    font-size: 13px;
    line-height: 1.5;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 12px 0;
    max-height: 240px;
    overflow-y: auto;
  }
  button {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
    padding: 12px;
    border: 1px solid var(--fv-color-border);
    border-radius: 8px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    text-align: left;
    overflow-wrap: anywhere;
    cursor: pointer;
    &[aria-pressed="true"] {
      border-color: var(--fv-color-brand);
      background: var(--fv-color-bg-active-soft);
    }
  }
}
</style>
