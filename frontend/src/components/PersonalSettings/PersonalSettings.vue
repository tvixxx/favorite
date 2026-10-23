<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Switch as ASwitch } from "ant-design-vue";
import { useMainStore } from "@/state/state";
import {
  getUserPreference,
  VISIBILITY_PREFERENCES_DEFAULTS,
  type UserPreferenceKey,
} from "@/utils/userPreferences";
import VisibilitySettings from "./VisibilitySettings.vue";

const props = withDefaults(
  defineProps<{ section?: "appearance" | "personal" | "notifications" }>(),
  { section: "appearance" }
);

const store = useMainStore();
const pending = ref<UserPreferenceKey | null>(null);
const error = ref("");
const failedAttempt = ref<{
  key: UserPreferenceKey;
  checked: boolean;
  userId: string;
  revision: number;
} | null>(null);

watch([() => store.userData?.id, () => store.sessionRevision], () => {
  error.value = "";
  failedAttempt.value = null;
});

const groups: Array<{
  id: "personal" | "notifications";
  title: string;
  tour?: string;
  items: Array<{ key: UserPreferenceKey; label: string; description?: string }>;
}> = [
  {
    id: "personal",
    title: "Персональные настройки",
    tour: "personal-settings",
    items: [
      {
        key: "quickAddEnabled",
        label: "Быстрый ввод",
        description:
          "Кнопка «Из каталога» для быстрого добавления фильмов и сериалов в коллекцию.",
      },
      {
        key: "watchTonightEnabled",
        label: "Что посмотреть сегодня",
        description: "Подбор из ещё не начатого в «Буду смотреть».",
      },
      {
        key: "collectionFilesEnabled",
        label: "Импорт и экспорт",
        description: "Загрузка коллекции из файла, скачивание и печать PDF.",
      },
    ],
  },
  {
    id: "notifications",
    title: "Уведомления",
    tour: "notification-settings",
    items: [
      { key: "notifyNewMessages", label: "Новые сообщения" },
      { key: "notifyFriendRequests", label: "Запросы в друзья" },
      { key: "notifyRecommendations", label: "Рекомендации от друзей" },
    ],
  },
];

const activeGroup = computed(() =>
  groups.find((group) => group.id === props.section)
);

async function savePreference(
  key: UserPreferenceKey,
  checked: boolean
): Promise<void> {
  if (pending.value || store.isUpdatingProfile || !store.userData?.id) return;

  const id = store.userData.id;
  const revision = store.sessionRevision;

  pending.value = key;
  error.value = "";
  failedAttempt.value = null;
  try {
    await store.updateProfile({ [key]: checked });
  } catch {
    if (store.userData?.id === id && store.sessionRevision === revision) {
      error.value = "Не удалось сохранить настройку. Попробуйте ещё раз.";
      failedAttempt.value = { key, checked, userId: id, revision };
    }
  } finally {
    pending.value = null;
  }
}

function retryPreference(): void {
  const attempt = failedAttempt.value;

  if (
    attempt &&
    attempt.userId === store.userData?.id &&
    attempt.revision === store.sessionRevision
  ) {
    void savePreference(attempt.key, attempt.checked);
  }
}
</script>

<template>
  <div class="personal-settings">
    <VisibilitySettings
      v-if="section === 'appearance'"
      :user="store.userData"
      :disabled="pending !== null || store.isUpdatingProfile"
      :pending="pending"
      :error="error"
      :error-key="failedAttempt?.key"
      @change="savePreference"
      @retry="retryPreference"
    />
    <section
      v-else-if="activeGroup"
      :data-tour="activeGroup.tour"
      class="personal-settings__section"
    >
      <div class="personal-settings__list">
        <div
          v-for="item in activeGroup.items"
          :key="item.key"
          :data-tour="`setting-${item.key}`"
          class="personal-settings__row"
        >
          <div class="personal-settings__text">
            <span>{{ item.label }}</span>
            <p v-if="item.description">{{ item.description }}</p>
          </div>
          <label
            :for="`preference-${item.key}`"
            class="personal-settings__switch-target"
          >
            <ASwitch
              :id="`preference-${item.key}`"
              :checked="getUserPreference(store.userData, item.key)"
              :aria-label="item.label"
              :disabled="pending !== null || store.isUpdatingProfile"
              :loading="pending === item.key"
              @update:checked="savePreference(item.key, $event === true)"
            />
          </label>
        </div>
      </div>
    </section>
    <p
      v-if="
        error &&
        failedAttempt &&
        !(failedAttempt.key in VISIBILITY_PREFERENCES_DEFAULTS) &&
        activeGroup?.items.some((item) => item.key === failedAttempt?.key)
      "
      class="personal-settings__error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.personal-settings {
  display: grid;
  gap: var(--fv-space-24);

  &__text p {
    margin: 0;
    color: var(--fv-color-text-secondary);
    font-size: var(--fv-text-p4-size);
    line-height: var(--fv-text-p4-lh);
  }

  &__list {
    padding: 0 var(--fv-space-16);
    border-radius: var(--fv-radius-md);
    background: var(--fv-color-bg-secondary);
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--fv-space-16);
    padding: var(--fv-space-16) 0;
    border-bottom: 1px solid var(--fv-color-border);

    &:last-child {
      border-bottom: 0;
    }

    :deep(.ant-switch) {
      flex-shrink: 0;
    }
  }

  &__text {
    min-width: 0;
    font-size: var(--fv-text-p3-size);
    line-height: var(--fv-text-p3-lh);

    p {
      margin-top: var(--fv-space-4);
    }
  }

  &__switch-target {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    cursor: pointer;
  }

  &__error {
    margin: 0;
    color: var(--fv-color-negative);
  }
}
</style>
