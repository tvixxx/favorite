<script setup lang="ts">
import { ref } from "vue";
import { Switch as ASwitch } from "ant-design-vue";
import { useMainStore } from "@/state/state";
import {
  getUserPreference,
  type UserPreferenceKey,
} from "@/utils/userPreferences";

const store = useMainStore();
const pending = ref<UserPreferenceKey | null>(null);
const error = ref("");
const groups: Array<{
  title: string;
  tour?: string;
  items: Array<{ key: UserPreferenceKey; label: string; description?: string }>;
}> = [
  {
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
    title: "Уведомления",
    tour: "notification-settings",
    items: [
      { key: "notifyNewMessages", label: "Новые сообщения" },
      { key: "notifyFriendRequests", label: "Запросы в друзья" },
      { key: "notifyRecommendations", label: "Рекомендации от друзей" },
    ],
  },
];

async function savePreference(
  key: UserPreferenceKey,
  checked: boolean
): Promise<void> {
  if (pending.value || store.isUpdatingProfile || !store.userData?.id) return;

  const id = store.userData.id;

  pending.value = key;
  error.value = "";
  try {
    await store.updateProfile({ [key]: checked });
  } catch {
    if (store.userData?.id === id)
      error.value = "Не удалось сохранить настройку. Попробуйте ещё раз.";
  } finally {
    pending.value = null;
  }
}
</script>

<template>
  <div class="personal-settings">
    <p class="personal-settings__hint">
      Настройки сохраняются сразу для вашего аккаунта и доступны после входа на
      других устройствах.
    </p>
    <section
      v-for="group in groups"
      :key="group.title"
      :data-tour="group.tour"
      class="personal-settings__section"
    >
      <h3>{{ group.title }}</h3>
      <div class="personal-settings__list">
        <div
          v-for="item in group.items"
          :key="item.key"
          :data-tour="`setting-${item.key}`"
          class="personal-settings__row"
        >
          <div class="personal-settings__text">
            <span>{{ item.label }}</span>
            <p v-if="item.description">{{ item.description }}</p>
          </div>
          <ASwitch
            :checked="getUserPreference(store.userData, item.key)"
            :aria-label="item.label"
            :disabled="pending !== null || store.isUpdatingProfile"
            :loading="pending === item.key"
            @update:checked="savePreference(item.key, $event === true)"
          />
        </div>
      </div>
    </section>
    <p v-if="error" class="personal-settings__error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.personal-settings {
  display: grid;
  gap: var(--fv-space-24);

  &__hint,
  &__text p {
    margin: 0;
    color: var(--fv-color-text-secondary);
    font-size: var(--fv-text-p4-size);
    line-height: var(--fv-text-p4-lh);
  }

  h3 {
    margin: 0 0 var(--fv-space-12);
    font-size: var(--fv-text-p3-size);
    line-height: var(--fv-text-p3-lh);
    font-weight: var(--fv-weight-medium);
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

  &__error {
    margin: 0;
    color: var(--fv-color-negative);
  }
}
</style>
