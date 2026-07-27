<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import { useMediaQuery } from "@vueuse/core";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { useMainStore } from "@/state/state";
import { FETCH_METHOD, useFetch } from "@/composable";
import { FEEDBACK_ENDPOINT } from "@/constants";
import { isSuccessStatus } from "@/utils";
import { friendlyRequestError } from "@/utils/friendlyError";

/**
 * Страница «Обратная связь» (эталон new-8, вариант 1b).
 * Вместе с сообщением уходит автоконтекст: страница, браузер, вьюпорт —
 * пользователь предупреждён об этом строкой под формой.
 */

type FeedbackType = "IDEA" | "BUG" | "OTHER";

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 1000;
const SUPPORT_EMAIL = "help@favorite.app";

// Тон активной карточки подсказывает характер обращения:
// идея — синий, ошибка — красный, другое — нейтральный
const FEEDBACK_TYPES: Array<{
  value: FeedbackType;
  label: string;
  icon: string;
  tone: "accent" | "danger" | "neutral";
}> = [
  { value: "IDEA", label: "Идея", icon: "ph:lightbulb", tone: "accent" },
  { value: "BUG", label: "Ошибка", icon: "ph:bug", tone: "danger" },
  {
    value: "OTHER",
    label: "Другое",
    icon: "ph:chat-teardrop-text",
    tone: "neutral",
  },
];

// Статичный список: показывает, что обращения читают (эталон)
const DONE_ITEMS: Array<{ text: string; done: boolean }> = [
  { text: "Тёмная тема и цветовые схемы", done: true },
  { text: "Списки с цветными обложками", done: true },
  { text: "Прогресс по сезонам и сериям", done: true },
  { text: "Импорт коллекции — в работе", done: false },
];

const router = useRouter();
const mainStore = useMainStore();

const isMobile = useMediaQuery("(max-width: 767.98px)");

const type = ref<FeedbackType>("IDEA");
const text = ref("");
const email = ref("");
const isSending = ref(false);
const sendError = ref<string | null>(null);

// Страница, с которой пришли — уходит вместе с обращением
const fromUrl = ref("");

onMounted(() => {
  email.value = mainStore.userData?.email ?? "";

  const previous = router.options.history.state.back;
  fromUrl.value = typeof previous === "string" ? previous : "/feedback";
});

const messageLength = computed(() => text.value.trim().length);
const canSend = computed(
  () => messageLength.value >= MESSAGE_MIN && !isSending.value,
);

const goBack = (): void => {
  router.back();
};

const resetForm = (): void => {
  type.value = "IDEA";
  text.value = "";
};

const submit = async (): Promise<void> => {
  if (!canSend.value) {
    if (messageLength.value < MESSAGE_MIN) {
      message.error(`Сообщение должно быть от ${MESSAGE_MIN} символов`);
    }

    return;
  }

  isSending.value = true;
  sendError.value = null;

  try {
    const { status } = await useFetch<{ id: string }>(FEEDBACK_ENDPOINT, {
      method: FETCH_METHOD.post,
      data: {
        type: type.value,
        message: text.value.trim(),
        email: email.value.trim() || undefined,
        pageUrl: fromUrl.value,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    });

    if (!isSuccessStatus(status)) {
      throw new Error("Request failed");
    }

    message.success("Спасибо, сообщение отправлено");
    resetForm();
  } catch (error) {
    // Текст не теряем: пользователь может повторить отправку (эталон)
    sendError.value = friendlyRequestError(error, {
      byStatus: {
        429: "Слишком много обращений. Попробуйте позже.",
      },
      fallback: "Проверьте соединение и попробуйте ещё раз.",
    });
  } finally {
    isSending.value = false;
  }
};
</script>

<template>
  <div class="feedback-page">
    <div class="feedback-page__content">
      <!-- Мобильная шапка с «назад» (эталон) -->
      <div v-if="isMobile" class="feedback-page__mobile-head">
        <button
          type="button"
          class="feedback-page__back"
          aria-label="Назад"
          @click="goBack"
        >
          <BaseIcon name="ph:arrow-left" :width="19" :height="19" />
        </button>
        <span class="feedback-page__mobile-title">Обратная связь</span>
      </div>

      <div class="feedback-grid">
        <section class="feedback-card">
          <template v-if="!isMobile">
            <h1 class="feedback-card__title">Обратная связь</h1>
            <p class="feedback-card__lead">
              Расскажите, чего не хватает или что работает не так. Читаем каждое
              сообщение — многое из того, что есть сейчас, появилось по вашим
              просьбам.
            </p>
          </template>
          <p v-else class="feedback-card__lead">
            Расскажите, чего не хватает или что работает не так.
          </p>

          <span class="feedback-label">О чём расскажете?</span>
          <div class="feedback-types" role="radiogroup" aria-label="Тип обращения">
            <button
              v-for="item in FEEDBACK_TYPES"
              :key="item.value"
              type="button"
              role="radio"
              class="feedback-type"
              :class="[
                `feedback-type--${item.tone}`,
                { 'feedback-type--on': type === item.value },
              ]"
              :aria-checked="type === item.value"
              @click="type = item.value"
            >
              <BaseIcon :name="item.icon" :width="23" :height="23" />
              {{ item.label }}
            </button>
          </div>

          <span class="feedback-label">Сообщение</span>
          <a-textarea
            v-model:value="text"
            class="feedback-page__area"
            placeholder="Опишите идею или проблему — что происходит, чего ждали и как это можно улучшить."
            :rows="isMobile ? 4 : 5"
            :maxlength="MESSAGE_MAX"
          />
          <div class="feedback-page__counter">
            {{ messageLength }} / {{ MESSAGE_MAX }}
          </div>

          <!-- Вложения: в проекте пока нет хранилища файлов -->
          <div class="feedback-attach" aria-disabled="true">
            <BaseIcon name="ph:paperclip" :width="20" :height="20" />
            <span class="feedback-attach__text">
              Прикрепить скриншот
              <span class="feedback-attach__hint">— скоро</span>
            </span>
          </div>

          <span class="feedback-label">
            E-mail для ответа
            <span class="feedback-label__optional">— необязательно</span>
          </span>
          <a-input
            v-model:value="email"
            class="feedback-page__email"
            placeholder="name@mail.ru"
            type="email"
          >
            <template #prefix>
              <BaseIcon name="ph:envelope-simple" :width="18" :height="18" />
            </template>
          </a-input>

          <p class="feedback-page__context">
            <BaseIcon name="ph:info" :width="16" :height="16" />
            К сообщению приложим страницу, с которой вы пишете, и данные браузера
          </p>

          <StateBlock
            v-if="sendError"
            class="feedback-page__error"
            compact
            variant="error"
            icon="ph:warning-circle"
            title="Не удалось отправить"
            :description="sendError"
            :actions="[
              {
                label: 'Повторить',
                icon: 'ph:arrow-clockwise',
                kind: 'primary',
                loading: isSending,
                onClick: submit,
              },
            ]"
          />

          <a-button
            v-if="!isMobile"
            type="primary"
            class="feedback-page__submit"
            :disabled="!canSend"
            :loading="isSending"
            @click="submit"
          >
            <BaseIcon name="ph:paper-plane-right" :width="18" :height="18" />
            Отправить
          </a-button>
        </section>

        <aside class="feedback-aside">
          <section class="feedback-card feedback-card--aside">
            <h2 class="feedback-aside__title">Уже сделали</h2>
            <div
              v-for="item in DONE_ITEMS"
              :key="item.text"
              class="feedback-done"
            >
              <BaseIcon
                class="feedback-done__icon"
                :class="{ 'feedback-done__icon--todo': !item.done }"
                :name="item.done ? 'ph:check-circle-fill' : 'ph:circle-dashed'"
                :width="19"
                :height="19"
              />
              <span class="feedback-done__text">{{ item.text }}</span>
            </div>
          </section>

          <section class="feedback-card feedback-card--aside">
            <h2 class="feedback-aside__title">Что-то сломалось?</h2>
            <p class="feedback-aside__text">
              Если приложение не работает и ждать ответа некогда — напишите на
              <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a>
            </p>
          </section>
        </aside>
      </div>
    </div>

    <!-- Мобилка: кнопка закреплена внизу (эталон) -->
    <div v-if="isMobile" class="feedback-actionbar">
      <a-button
        type="primary"
        class="feedback-actionbar__btn"
        :disabled="!canSend"
        :loading="isSending"
        @click="submit"
      >
        <BaseIcon name="ph:paper-plane-right" :width="18" :height="18" />
        Отправить
      </a-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/layout" as *;
@use "@/styles/media" as *;

.feedback-page {
  @include pageShell(4rem);

  &__content {
    max-width: 1180px;
    margin: 0 auto;
    padding: 2rem 1rem 0;
    // #app центрирует текст глобально
    text-align: left;

    @include mediaTablet {
      padding: 2.5rem 2rem 0;
    }
  }

  &__mobile-head {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 16px;
  }

  &__back {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 50%;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }
  }

  &__mobile-title {
    font-size: 16px;
    font-weight: 600;
  }

  &__area {
    :deep(textarea.ant-input) {
      border-radius: 14px;
      padding: 13px 15px;
      font-size: 15px;
      resize: vertical;
    }
  }

  &__counter {
    margin: 6px 0 18px;
    font-size: 12px;
    color: var(--fv-color-text-tertiary);
    text-align: right;
  }

  &__email {
    :deep(.ant-input-affix-wrapper) {
      height: 46px;
      padding: 0 14px;
    }

    :deep(.ant-input-prefix) {
      margin-inline-end: 10px;
      color: var(--fv-color-text-tertiary);
    }
  }

  &__context {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 20px;
    font-size: 13px;
    color: var(--fv-color-text-tertiary);

    svg {
      flex-shrink: 0;
    }
  }

  &__error {
    margin-bottom: 18px;
  }

  &__submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 46px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
  }
}

/* Сетка: форма + правый столбец (эталон 1fr 300px) */
.feedback-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 22px;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.feedback-card {
  padding: 22px;
  border-radius: var(--fv-radius-lg);
  background: var(--fv-color-bg-primary);
  box-shadow: var(--fv-shadow-low);

  &__title {
    margin: 0 0 6px;
    font-family: var(--fv-font-display);
    font-size: 24px;
    font-weight: 500;
    line-height: 1.2;
    color: var(--fv-color-text-primary);
  }

  &__lead {
    margin: 0 0 20px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--fv-color-text-secondary);
  }
}

.feedback-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--fv-color-text-secondary);

  &__optional {
    color: var(--fv-color-text-tertiary);
    font-weight: 400;
  }
}

/* Карточки типа обращения (эталон .typebtn) */
.feedback-types {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.feedback-type {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 14px 8px;
  border: 1.5px solid var(--fv-color-border);
  border-radius: 14px;
  background: var(--fv-color-bg-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--fv-color-text-secondary);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;

  &:hover:not(.feedback-type--on) {
    border-color: color-mix(
      in srgb,
      var(--fv-color-text-primary) 25%,
      var(--fv-color-border)
    );
  }

  &:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 2px;
  }

  // Активная карточка окрашивается по смыслу обращения
  &--on.feedback-type--accent {
    border-color: var(--fv-color-accent);
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
  }

  &--on.feedback-type--danger {
    border-color: var(--fv-color-brand);
    background: var(--fv-color-negative-soft);
    color: var(--fv-color-brand);
  }

  &--on.feedback-type--neutral {
    border-color: var(--fv-color-text-secondary);
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
  }

  @media (max-width: 767.98px) {
    padding: 12px 6px;
    font-size: 12px;
  }
}

/* Вложения: блок виден, но пока не активен (нет хранилища файлов) */
.feedback-attach {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 16px;
  margin-bottom: 18px;
  border-radius: 14px;
  background: var(--fv-color-bg-secondary);
  color: var(--fv-color-text-secondary);
  opacity: 0.7;
  cursor: not-allowed;

  &__text {
    font-size: 14.5px;
  }

  &__hint {
    color: var(--fv-color-text-tertiary);
  }
}

.feedback-aside {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__title {
    margin: 0 0 14px;
    font-size: 15px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__text {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--fv-color-text-secondary);
  }
}

.feedback-done {
  display: flex;
  gap: 10px;

  &:not(:last-child) {
    margin-bottom: 12px;
  }

  &__icon {
    flex-shrink: 0;
    color: var(--fv-color-positive);

    &--todo {
      color: var(--fv-color-text-tertiary);
    }
  }

  &__text {
    font-size: 13.5px;
    line-height: 1.45;
    color: var(--fv-color-text-secondary);
  }
}

/* Мобилка: кнопка закреплена внизу (эталон) */
.feedback-actionbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 80;
  padding: 12px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--fv-color-border);
  background: color-mix(in srgb, var(--fv-color-bg-primary) 94%, transparent);
  backdrop-filter: blur(10px);

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 48px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
  }
}

@media (max-width: 767.98px) {
  // Место под закреплённую кнопку
  .feedback-page__content {
    padding-bottom: 96px;
  }
}
</style>
