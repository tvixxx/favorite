<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const modelValue = defineModel<boolean>();
const emit = defineEmits<{ confirm: [] }>();

const modal = ref<HTMLElement | null>(null);
const previousFocus = ref<HTMLElement | null>(null);

function lockScroll() {
  document.body.style.overflow = "hidden";
}

function unlockScroll() {
  document.body.style.overflow = "";
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    modelValue.value = false;
  }
}

function setPrevFocus() {
  previousFocus.value = document.activeElement as HTMLElement;
}

function activatePrevFocus(): void {
  previousFocus.value?.focus();
}

watch(modelValue, async (open) => {
  if (open) {
    setPrevFocus();
    lockScroll();
    modal.value?.focus();
    await nextTick();
    window.addEventListener("keydown", onKeydown);
  } else {
    unlockScroll();
    window.removeEventListener("keydown", onKeydown);
    activatePrevFocus();
  }
});

const close = () => (modelValue.value = false);

const handleConfirm = () => {
  emit("confirm");
};
</script>

<template>
  <Teleport to="body" :disabled="!modelValue">
    <Transition name="fade">
      <div v-if="modelValue" class="modal-backdrop" @click.self="close">
        <div
          ref="modal"
          class="modal"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
        >
          <div class="modal__header">
            <h3 class="modal__header-text">
              <slot name="title">Заголовок</slot>
            </h3>
            <button @click="modelValue = false" class="modal__close">
              <BaseIcon name="mdi:close" />
            </button>
          </div>

          <div class="modal__body">
            <div class="modal__body">
              <slot name="body" />
            </div>
          </div>

          <div class="modal__footer">
            <slot name="footer">
              <a-button @click="modelValue = false">Отмена</a-button>
              <a-button type="primary" @click="handleConfirm"
                >Сохранить</a-button
              >
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss">
@use "../../styles/screen-sizes" as *;
@use "../../styles/media" as *;

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 2rem;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--bg-primary);
  border-radius: 24px;
  max-width: min(90vw, 500px);
  max-height: 90vh;
  width: 100%;
  overflow: hidden;
  box-shadow: var(--shadow), 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border-color);
  animation: modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2rem 2.5rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal__header-text {
  color: var(--text-primary);
  font-size: clamp(1.25rem, 4vw, 1.75rem);
  font-weight: 800;
  margin: 0;
  background: linear-gradient(
    135deg,
    var(--ant-color-primary),
    var(--text-primary)
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.modal__close {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: none;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--ant-color-primary);
    color: white;
    transform: scale(1.05);
  }
}

.modal__body {
  padding: 16px 20px;
  max-height: 400px;
  overflow-y: auto;
}

.modal__footer {
  padding: 1.5rem 2.5rem 2.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.modal__btn-cancel,
.modal__btn-confirm {
  height: 48px;
  border-radius: 12px;
  font-weight: 600;
}

.modal__btn-confirm {
  min-width: 140px;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

// Стилизация Ant Design элементов
:deep(.ant-form-item-label > label) {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

:deep(.ant-input, .ant-picker, .ant-textarea) {
  border-radius: 12px !important;
  border: 2px solid var(--border-color) !important;
  transition: all 0.2s ease !important;
  height: 48px !important;
  box-shadow: none !important;

  &:focus,
  &:hover {
    border-color: var(--ant-color-primary) !important;
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--ant-color-primary) 10%, transparent) !important;
  }
}

:deep(.ant-form-item-has-error .ant-input) {
  border-color: var(--ant-color-error) !important;
}

:deep(.ant-textarea) {
  min-height: 120px !important;
  resize: vertical !important;
}

@include mediaMobile {
  .modal__header,
  .modal__body,
  .modal__footer {
    padding-left: 2rem;
    padding-right: 2rem;
  }
}
</style>
