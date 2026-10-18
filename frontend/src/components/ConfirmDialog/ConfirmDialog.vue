<script setup lang="ts">
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import AppSpinner from "@/components/AppSpinner/AppSpinner.vue";

const open = defineModel<boolean>({ required: true });

const props = withDefaults(
  defineProps<{
    title: string;
    subject?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    /** phosphor-имя иконки в круге */
    icon?: string;
    loading?: boolean;
  }>(),
  {
    description: "",
    confirmText: "Удалить",
    cancelText: "Отмена",
    icon: "ph:trash",
    loading: false,
  }
);

const emit = defineEmits<{ confirm: [] }>();

const onConfirm = (): void => {
  emit("confirm");
};
</script>

<template>
  <BaseModal
    v-model="open"
    headerless
    :aria-label="
      props.subject ? `${props.title} ${props.subject}` : props.title
    "
  >
    <template #body>
      <div class="confirm-dialog__body">
        <div class="confirm-dialog__heading">
          <span class="confirm-dialog__icon" aria-hidden="true">
            <BaseIcon :name="props.icon" :width="26" :height="26" />
          </span>
          <div class="confirm-dialog__copy">
            <h3 class="confirm-dialog__title">{{ props.title }}</h3>
            <p v-if="props.subject" class="confirm-dialog__subject">
              {{ props.subject }}
            </p>
          </div>
        </div>
        <p v-if="props.description" class="confirm-dialog__desc">
          {{ props.description }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="confirm-dialog__footer">
        <button
          type="button"
          class="confirm-dialog__btn confirm-dialog__btn--ghost"
          :disabled="props.loading"
          @click="open = false"
        >
          {{ props.cancelText }}
        </button>
        <button
          type="button"
          class="confirm-dialog__btn confirm-dialog__btn--danger"
          :disabled="props.loading"
          @click="onConfirm"
        >
          <AppSpinner v-if="props.loading" :size="18" on-dark />
          {{ props.confirmText }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.confirm-dialog {
  &__body {
    text-align: left;
    padding: 28px 24px 8px;

    @include mediaMax(767.98px) {
      padding: 28px 22px 12px;
    }
  }

  &__heading {
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }

  &__copy {
    min-width: 0;
    padding-top: 2px;
  }

  &__icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--fv-color-negative-soft);
    color: var(--fv-color-negative);
  }

  &__title {
    margin: 0;
    font-family: var(--fv-font-display);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--fv-color-text-primary);
    overflow-wrap: anywhere;
  }

  &__subject {
    margin: 8px 0 0;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--fv-color-text-secondary);
    overflow-wrap: anywhere;
  }

  &__desc {
    margin: 20px 0 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--fv-color-text-secondary);
  }

  &__footer {
    display: flex;
    // Мобайл: колонка, primary (Удалить) сверху; десктоп: строка справа
    flex-direction: column-reverse;
    gap: 10px;
    width: 100%;

    @include mediaTablet {
      flex-direction: row;
      justify-content: flex-end;
    }
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 48px;
    border: 0;
    border-radius: var(--fv-radius-sm);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--fv-motion-fast) var(--fv-ease),
      opacity var(--fv-motion-fast) var(--fv-ease);

    @include mediaTablet {
      width: auto;
      min-width: 130px;
      padding-inline: 22px;
    }

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 3px;
    }

    &--danger {
      background: var(--fv-color-brand);
      color: #fff;

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--fv-color-brand), #000 10%);
      }
    }

    &--ghost {
      background: var(--fv-color-bg-secondary);
      color: var(--fv-color-text-primary);

      &:hover:not(:disabled) {
        background: color-mix(
          in srgb,
          var(--fv-color-text-primary) 6%,
          var(--fv-color-bg-secondary)
        );
      }
    }
  }
}
</style>
