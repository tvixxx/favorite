<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import api from "@/services/api";
import { blurAfterTouchSelect } from "@/utils/touchSelect";
import { avatarGradient, avatarLetter } from "@/composable/useAvatarGradient";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import type { FriendUser } from "@/stores/friends/friendsStore";

type FoundUser = Pick<FriendUser, "id" | "fullName" | "username">;

const selected = defineModel<FoundUser | null>({ default: null });
const props = defineProps<{ disabled?: boolean }>();
const query = ref("");
const users = ref<FoundUser[]>([]);
const loading = ref(false);
const pending = ref(false);
const error = ref(false);
const searched = ref(false);
const retry = ref(0);
const input = ref<HTMLInputElement>();
const helpId = useId();
const resultKey = computed(() =>
  JSON.stringify(users.value.map((user) => user.id).sort())
);

defineExpose({ focus: () => input.value?.focus() });

watch([query, retry], ([value], _previous, cleanup) => {
  selected.value = null;

  const term = value.trim();

  if (term.length < 2) {
    loading.value = false;
    pending.value = !!term;
    if (!term) {
      users.value = [];
      error.value = false;
      searched.value = false;
    }

    return;
  }

  pending.value = true;

  const controller = new AbortController();

  const timer = setTimeout(async () => {
    loading.value = true;
    try {
      const { data } = await api.get<FoundUser[]>("/users/search", {
        params: { query: term },
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        users.value = data;
        error.value = false;
        searched.value = true;
      }
    } catch {
      if (!controller.signal.aborted) error.value = true;
    } finally {
      if (!controller.signal.aborted) {
        loading.value = false;
        pending.value = false;
      }
    }
  }, 300);

  cleanup(() => {
    clearTimeout(timer);
    controller.abort();
  });
});
</script>

<template>
  <div class="user-search">
    <label>
      <span>Имя, ник или почта</span>
      <input
        ref="input"
        v-model="query"
        class="fv-native-field"
        :disabled="props.disabled"
        maxlength="100"
        type="search"
        autocomplete="off"
        autocapitalize="none"
        :spellcheck="false"
        placeholder="Например, Анна или anna_movies"
        :aria-describedby="helpId"
      />
    </label>
    <p :id="helpId" class="user-search__help">
      Введите хотя бы два символа. Если имена совпадают, уточните ник или почту
      у друга.
    </p>
    <div class="user-search__results" :aria-busy="loading">
      <div
        v-if="error && searched"
        class="user-search__refresh-error"
        role="alert"
      >
        <p>Не удалось обновить результаты. Показана предыдущая выдача.</p>
        <button
          type="button"
          class="user-search__retry"
          :disabled="props.disabled || pending"
          @click="retry++"
        >
          Повторить поиск
        </button>
      </div>
      <div v-if="loading && !searched" class="fv-friend-enter" role="status">
        <p class="user-search__status">
          <BaseIcon name="ph:magnifying-glass" /> Ищем людей…
        </p>
        <div class="user-search__skeleton" aria-hidden="true">
          <SkeletonBar circle width="48px" height="48px" />
          <div>
            <SkeletonBar width="65%" height="16px" /><SkeletonBar
              width="45%"
              height="12px"
            />
          </div>
        </div>
      </div>
      <div
        v-else-if="error && !searched"
        class="user-search__state fv-friend-enter"
        role="alert"
      >
        <BaseIcon name="ph:warning-circle" :width="32" :height="32" />
        <strong>Не удалось выполнить поиск</strong>
        <p>Проверьте подключение и попробуйте ещё раз.</p>
        <button
          type="button"
          class="user-search__retry"
          :disabled="props.disabled"
          @click="retry++"
        >
          Повторить поиск
        </button>
      </div>
      <div v-else-if="users.length">
        <p class="user-search__status" role="status">
          Выберите нужного человека
        </p>
        <ul :key="resultKey" class="fv-friend-enter">
          <li v-for="user in users" :key="user.id">
            <button
              type="button"
              class="user-search__result"
              :disabled="props.disabled || pending || error"
              :aria-pressed="selected?.id === user.id"
              @click="
                selected = user;
                blurAfterTouchSelect();
              "
            >
              <span
                class="user-search__avatar"
                :style="{ background: avatarGradient(user.id) }"
                aria-hidden="true"
                >{{ avatarLetter(user.fullName) }}</span
              >
              <span class="user-search__identity"
                ><strong>{{ user.fullName }}</strong
                ><span>{{ user.username || "Ник не указан" }}</span></span
              >
              <BaseIcon name="ph:arrow-right" />
            </button>
          </li>
        </ul>
      </div>
      <div
        v-else
        class="user-search__state"
        :class="{ 'fv-friend-enter': searched }"
        role="status"
      >
        <BaseIcon name="ph:users" :width="32" :height="32" />
        <strong>{{
          searched ? "Никого не нашли" : "Кого вы хотите добавить?"
        }}</strong>
        <p>
          {{
            searched
              ? "Проверьте написание или попросите друга прислать свой ник."
              : "Найдите человека, затем выберите: дружить или подписаться."
          }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.user-search {
  min-width: 0;
  input {
    font-size: 16px;
  }
  label {
    display: grid;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
  }
  p {
    margin: 0;
    color: var(--fv-color-text-secondary);
    font-size: 13px;
    line-height: 1.5;
  }
  &__help {
    margin: 10px 0 20px !important;
  }
  &__results {
    min-height: 160px;
  }
  &__status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px !important;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 10px;
  }
  &__result,
  &__skeleton {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--fv-color-border);
    border-radius: 16px;
  }
  &__result {
    width: 100%;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    text-align: left;
    cursor: pointer;
    &:hover,
    &:focus-visible {
      border-color: var(--fv-color-brand);
    }
    &:focus-visible {
      outline: 2px solid var(--fv-color-brand);
      outline-offset: 2px;
    }
    > :last-child {
      flex-shrink: 0;
    }
  }
  &__avatar {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: white;
    font-size: 20px;
    font-weight: 600;
  }
  &__identity {
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 4px;
    overflow-wrap: anywhere;
    strong {
      font-size: 14px;
      font-weight: 500;
    }
    > span {
      color: var(--fv-color-text-secondary);
      font-size: 13px;
    }
  }
  &__skeleton {
    margin-bottom: 10px;
    > div {
      display: grid;
      gap: 10px;
      flex: 1;
    }
  }
  &__state {
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 24px 16px;
    border: 1px dashed var(--fv-color-border);
    border-radius: 16px;
    text-align: center;
    color: var(--fv-color-text-secondary);
    strong {
      font-size: 14px;
      font-weight: 500;
      color: var(--fv-color-text-primary);
    }
  }
  &__refresh-error {
    display: grid;
    justify-items: start;
    gap: 8px;
    margin-bottom: 12px;
  }
  &__retry {
    min-height: 44px;
    padding: 8px 16px;
    border: 1px solid var(--fv-color-border);
    border-radius: 12px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    cursor: pointer;
  }
}
</style>
