<script setup lang="ts">
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import AppSpinner from "@/components/AppSpinner/AppSpinner.vue";

const open = defineModel<boolean>({ required: true });

const props = withDefaults(
  defineProps<{
    title: string;
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
  },
);

const emit = defineEmits<{ confirm: [] }>();

const onConfirm = (): void => {
  emit("confirm");
};
</script>

<template>
  <BaseModal v-model="open" headerless :aria-label="props.title">
    <template #body>
      <div class="confirm-dialog__body">
        <span class="confirm-dialog__icon" aria-hidden="true">
          <BaseIcon :name="props.icon" :width="34" :height="34" />
        </span>
        <h3 class="confirm-dialog__title">{{ props.title }}</h3>
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
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 28px 24px 8px;
  }

  &__icon {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    margin-bottom: 16px;
    // Эталон delete-confirm: negative-soft заливка в скруглённом квадрате (r14)
    border-radius: 50%;
    background: var(--fv-color-negative-soft);
    color: var(--fv-color-negative);
  }

  &__title {
    margin: 0 0 6px;
    font-family: var(--fv-font-display);
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1.2;
    color: var(--fv-color-text-primary);
  }

  &__desc {
    margin: 0;
    max-width: 320px;
    font-size: 0.92rem;
    line-height: 1.45;
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
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
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
