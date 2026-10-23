<script setup lang="ts">
import {
  Radio as ARadio,
  RadioGroup as ARadioGroup,
  Switch as ASwitch,
} from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import {
  getUserPreference,
  type UserPreferenceKey,
  type UserPreferences,
} from "@/utils/userPreferences";

defineProps<{
  user: Partial<UserPreferences> | null | undefined;
  disabled: boolean;
  pending: UserPreferenceKey | null;
  error?: string;
  errorKey?: UserPreferenceKey;
}>();

defineEmits<{
  change: [key: UserPreferenceKey, checked: boolean];
  retry: [];
}>();

const items = [
  {
    key: "showAchievements",
    title: "Достижения",
    label: "Показывать достижения",
    description:
      "Награды и прогресс в вашем профиле. При скрытии достижения сохраняются.",
  },
  {
    key: "showDetailedAnalytics",
    title: "Подробная аналитика",
    label: "Подробная аналитика",
    description:
      "Тренды и топ жанров. Основные счётчики коллекции остаются всегда.",
  },
  {
    key: "showCommunityTops",
    title: "Топы сообщества",
    label: "Топы сообщества",
    description:
      "Пункт «Топ» в основном меню. Участие в рейтингах не меняется.",
  },
  {
    key: "showActorsSection",
    title: "Раздел «Актёры»",
    label: "Раздел «Актёры»",
    description:
      "Вкладка медиатеки. Актёрский состав в карточках произведений остаётся.",
  },
] as const;
</script>

<template>
  <section class="visibility-settings" aria-label="Настройки вида приложения">
    <article
      v-for="item in items"
      :key="item.key"
      class="visibility-settings__card"
    >
      <div class="visibility-settings__heading">
        <div class="visibility-settings__text">
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </div>
        <label
          v-if="item.key !== 'showDetailedAnalytics'"
          :for="`visibility-${item.key}`"
          class="visibility-settings__switch-target"
        >
          <ASwitch
            :id="`visibility-${item.key}`"
            :aria-label="item.label"
            :checked="getUserPreference(user, item.key)"
            :disabled="disabled"
            :loading="pending === item.key"
            @update:checked="$emit('change', item.key, $event === true)"
          />
        </label>
      </div>
      <ARadioGroup
        v-if="item.key === 'showDetailedAnalytics'"
        class="visibility-settings__modes"
        aria-label="Вид аналитики"
        :value="getUserPreference(user, item.key) ? 'detailed' : 'basic'"
        :disabled="disabled"
        @update:value="$emit('change', item.key, $event === 'detailed')"
      >
        <ARadio value="basic" class="visibility-settings__mode"
          ><span>Основная</span><small>Только счётчики коллекции</small></ARadio
        >
        <ARadio value="detailed" class="visibility-settings__mode"
          ><span>Подробная</span
          ><small>С трендами и топом жанров</small></ARadio
        >
      </ARadioGroup>
      <div
        class="visibility-settings__preview"
        :data-preview="item.key"
        aria-live="polite"
      >
        <template v-if="item.key === 'showAchievements'">
          <span class="visibility-settings__preview-title">Ваш профиль</span>
          <Transition name="preview-reveal"
            ><div
              v-if="getUserPreference(user, item.key)"
              class="preview-reveal"
              data-preview-detail
            >
              <div>
                <span class="visibility-settings__preview-detail"
                  ><BaseIcon
                    name="ph:trophy"
                    :width="16"
                    :height="16"
                  />Достижения</span
                >
              </div>
            </div></Transition
          >
          <span class="visibility-settings__preview-base"
            >Коллекция · Основные счётчики</span
          >
          <p>
            {{
              getUserPreference(user, item.key)
                ? "Блок достижений виден"
                : "Блок достижений скрыт, награды сохраняются"
            }}
          </p>
        </template>
        <template v-else-if="item.key === 'showDetailedAnalytics'">
          <span class="visibility-settings__preview-title"
            >Статистика профиля</span
          >
          <span class="visibility-settings__preview-base"
            >Основные счётчики коллекции</span
          >
          <Transition name="preview-reveal"
            ><div
              v-if="getUserPreference(user, item.key)"
              class="preview-reveal"
              data-preview-detail
            >
              <div>
                <span class="visibility-settings__preview-detail"
                  ><BaseIcon
                    name="ph:chart-line-up"
                    :width="16"
                    :height="16"
                  />Тренды и топ жанров</span
                >
              </div>
            </div></Transition
          >
          <p>
            {{
              getUserPreference(user, item.key)
                ? "Подробная аналитика видна"
                : "Подробная аналитика скрыта"
            }}
          </p>
        </template>
        <template v-else-if="item.key === 'showCommunityTops'">
          <span class="visibility-settings__preview-title">Основное меню</span>
          <div class="visibility-settings__preview-menu">
            <span>Медиатека</span>
            <Transition name="preview-pill"
              ><div
                v-if="getUserPreference(user, item.key)"
                class="preview-pill"
                data-preview-detail
              >
                <div>
                  <span class="visibility-settings__preview-detail">Топ</span>
                </div>
              </div></Transition
            >
            <span>Общение</span>
          </div>
          <p>
            {{
              getUserPreference(user, item.key)
                ? "Топы доступны из меню"
                : "Пункт «Топ» скрыт из меню"
            }}
          </p>
        </template>
        <template v-else>
          <span class="visibility-settings__preview-title"
            >Разделы медиатеки</span
          >
          <div class="visibility-settings__preview-menu">
            <span>Коллекция</span><span>Каталог</span>
            <Transition name="preview-pill"
              ><div
                v-if="getUserPreference(user, item.key)"
                class="preview-pill"
                data-preview-detail
              >
                <div>
                  <span class="visibility-settings__preview-detail"
                    >Актёры</span
                  >
                </div>
              </div></Transition
            >
            <span>Списки</span>
          </div>
          <p>
            {{
              getUserPreference(user, item.key)
                ? "Вкладка «Актёры» видна"
                : "Вкладка «Актёры» скрыта, актёрский состав остаётся"
            }}
          </p>
        </template>
      </div>
      <div
        v-if="error && errorKey === item.key"
        class="visibility-settings__error"
        role="alert"
      >
        <span>{{ error }}</span>
        <button type="button" :disabled="disabled" @click="$emit('retry')">
          Повторить
        </button>
      </div>
    </article>
    <p class="visibility-settings__hint">
      Меняется только ваш интерфейс. Эти настройки не меняют видимость профиля
      для других.
    </p>
  </section>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;
.visibility-settings {
  display: grid;
  gap: var(--fv-space-16);

  h3 {
    margin: 0;
    font-size: var(--fv-text-p3-size);
    line-height: var(--fv-text-p3-lh);
    font-weight: var(--fv-weight-medium);
  }
  :where(p) {
    margin: 0;
    font-size: var(--fv-text-p4-size);
    line-height: var(--fv-text-p4-lh);
    color: var(--fv-color-text-secondary);
  }
  &__hint {
    margin-top: var(--fv-space-8);
  }
  &__card {
    display: grid;
    gap: var(--fv-space-16);
    padding: var(--fv-space-16);
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-md);
    min-width: 0;
  }
  &__heading {
    display: flex;
    align-items: flex-start;
    gap: var(--fv-space-12);
  }
  &__text {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    p {
      margin-top: var(--fv-space-4);
    }
  }
  &__switch-target {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    cursor: pointer;
  }
  &__modes {
    display: grid;
    gap: var(--fv-space-8);
  }
  &__mode {
    display: flex;
    align-items: center;
    min-height: 68px;
    margin: 0;
    padding: var(--fv-space-12);
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-sm);
    font-size: var(--fv-text-p3-size);
    line-height: var(--fv-text-p3-lh);
    small {
      display: block;
      font-size: var(--fv-text-p4-size);
      line-height: var(--fv-text-p4-lh);
      color: var(--fv-color-text-secondary);
    }
    &.ant-radio-wrapper-checked {
      border-color: var(--fv-color-accent);
      background: var(--fv-color-accent-soft);
    }
    :deep(.ant-radio) {
      align-self: center;
    }
  }
  &__preview {
    display: grid;
    padding: var(--fv-space-12);
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-secondary);
    min-width: 0;
    > * + * {
      margin-top: var(--fv-space-8);
    }
    p {
      font-size: var(--fv-text-caption-size);
      line-height: var(--fv-text-caption-lh);
    }
  }
  &__preview-title {
    font-size: var(--fv-text-p4-size);
    line-height: var(--fv-text-p4-lh);
    font-weight: var(--fv-weight-medium);
  }
  &__preview-detail,
  &__preview-base {
    display: flex;
    align-items: center;
    gap: var(--fv-space-8);
    padding: var(--fv-space-8);
    border-radius: var(--fv-radius-control);
    background: var(--fv-color-bg-primary);
    font-size: var(--fv-text-caption-size);
    line-height: var(--fv-text-caption-lh);
  }
  &__preview-detail {
    color: var(--fv-color-accent);
  }
  &__preview-menu {
    display: flex;
    flex-wrap: wrap;
    row-gap: var(--fv-space-4);
    > span,
    .preview-pill {
      margin-right: var(--fv-space-4);
      flex-shrink: 0;
    }
    > span {
      padding: 6px var(--fv-space-8);
      border-radius: var(--fv-radius-control);
      background: var(--fv-color-bg-primary);
      font-size: var(--fv-text-caption-size);
      line-height: var(--fv-text-caption-lh);
    }
  }
  &__error {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--fv-space-8);
    padding: var(--fv-space-12);
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-negative-soft);
    color: var(--fv-color-negative);
    font-size: var(--fv-text-p4-size);
    line-height: var(--fv-text-p4-lh);
    button {
      min-height: 44px;
      padding: var(--fv-space-8) var(--fv-space-12);
      border: 0;
      border-radius: var(--fv-radius-control);
      font: inherit;
      color: inherit;
      background: transparent;
      cursor: pointer;
    }
  }
}

.preview-reveal {
  display: grid;
  grid-template-rows: 1fr;
  > div {
    min-height: 0;
    overflow: hidden;
  }
}
.preview-pill {
  display: grid;
  grid-template-columns: 1fr;
  > div {
    display: flex;
    min-width: 0;
    overflow: hidden;
  }
  .visibility-settings__preview-detail {
    white-space: nowrap;
    padding: 6px var(--fv-space-8);
  }
}
.preview-reveal-enter-active,
.preview-reveal-leave-active {
  transition: grid-template-rows 200ms var(--fv-ease), opacity 160ms ease,
    margin-top 200ms var(--fv-ease);
}
.preview-pill-enter-active,
.preview-pill-leave-active {
  transition: grid-template-columns 200ms var(--fv-ease), opacity 160ms ease,
    margin-right 200ms var(--fv-ease);
}
.preview-reveal-enter-from,
.preview-reveal-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
.visibility-settings__preview > .preview-reveal-enter-from,
.visibility-settings__preview > .preview-reveal-leave-to {
  margin-top: 0;
}
.preview-pill-enter-from,
.preview-pill-leave-to {
  grid-template-columns: 0fr;
  opacity: 0;
}
.visibility-settings__preview-menu > .preview-pill-enter-from,
.visibility-settings__preview-menu > .preview-pill-leave-to {
  margin-right: 0;
}
@include mediaMin(1101px) {
  .visibility-settings {
    &__card {
      grid-template-columns: minmax(0, 1fr) 240px;
      gap: 12px 24px;
      align-items: center;
    }
    &__preview {
      grid-column: 2;
      grid-row: 1 / span 2;
    }
    &__modes {
      grid-column: 1;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}
@include mediaReducedMotion {
  .preview-reveal-enter-active,
  .preview-reveal-leave-active,
  .preview-pill-enter-active,
  .preview-pill-leave-active {
    transition: none;
  }
}
</style>
