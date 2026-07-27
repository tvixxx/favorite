<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useScrollLock } from "@/composable/useScrollLock";

const modelValue = defineModel<boolean>();

defineProps<{
  layout?: "default" | "detail" | "form";
  /** Скрыть стандартную белую шапку — контент сам рисует обложку (edge-to-edge) */
  headerless?: boolean;
  /** Доступное имя диалога для headerless-режима (когда нет заголовка) */
  ariaLabel?: string;
}>();
const emit = defineEmits<{ confirm: [] }>();

const modal = ref<HTMLElement | null>(null);
const previousFocus = ref<HTMLElement | null>(null);
// Стабильный id заголовка → aria-labelledby (SR читает имя диалога)
const titleId = useId();

// <768px — модалка превращается в action sheet снизу (эталон)
const isSheet = useMediaQuery("(max-width: 767.98px)");

// Свайп вниз по листу для закрытия
const dragOffset = ref(0);
const dragStartY = ref<number | null>(null);
const dragActive = ref(false);

const dragStyle = computed(() =>
  dragOffset.value > 0
    ? { transform: `translateY(${dragOffset.value}px)`, transition: "none" }
    : undefined,
);

function onTouchStart(e: TouchEvent): void {
  if (!isSheet.value) {
    return;
  }

  const body = modal.value?.querySelector(".modal__body");
  // тянем лист только если тело прокручено к верху — иначе это обычный скролл
  dragActive.value = !body || body.scrollTop <= 0;
  dragStartY.value = e.touches[0]?.clientY ?? null;
}

function onTouchMove(e: TouchEvent): void {
  if (!dragActive.value || dragStartY.value === null) {
    return;
  }

  const delta = (e.touches[0]?.clientY ?? 0) - dragStartY.value;
  dragOffset.value = Math.max(0, delta);
}

function onTouchEnd(): void {
  if (dragOffset.value > 90) {
    modelValue.value = false;
  }

  dragOffset.value = 0;
  dragStartY.value = null;
  dragActive.value = false;
}

// Блокировка скролла страницы без сдвига лейаута (порт @angular/cdk BlockScrollStrategy)
const { lock: lockScroll, unlock: unlockScroll } = useScrollLock();

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(): HTMLElement[] {
  if (!modal.value) {
    return [];
  }

  return Array.from(
    modal.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.offsetParent !== null);
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    modelValue.value = false;

    return;
  }

  if (e.key !== "Tab" || !modal.value) {
    return;
  }

  // Фокус-трап: Tab не выпускает фокус из диалога на фон
  const focusable = getFocusable();
  const active = document.activeElement as HTMLElement | null;

  if (focusable.length === 0) {
    e.preventDefault();
    modal.value.focus();

    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (!active || !modal.value.contains(active)) {
    e.preventDefault();
    first.focus();

    return;
  }

  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
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
    dragOffset.value = 0;
    window.addEventListener("keydown", onKeydown);
    await nextTick();
    // Фокус переносим ПОСЛЕ рендера диалога (иначе .focus() — no-op) на контейнер:
    // role=dialog + aria-labelledby → скринридер озвучивает заголовок
    modal.value?.focus();
  } else {
    unlockScroll();
    window.removeEventListener("keydown", onKeydown);
    activatePrevFocus();
  }
});

// Если компонент размонтируют с открытой модалкой (напр. смена роута),
// watcher закрытия не сработает — снимаем keydown вручную, чтобы не текло
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});

const close = () => (modelValue.value = false);

const handleConfirm = () => {
  emit("confirm");
};
</script>

<template>
  <Teleport to="body" :disabled="!modelValue">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-backdrop"
        :class="{ 'modal-backdrop--sheet': isSheet }"
        @click.self="close"
      >
        <div
          ref="modal"
          class="modal"
          :class="{
            'modal--detail': layout === 'detail',
            'modal--form': layout === 'form',
            'modal--headerless': headerless,
            'modal--sheet': isSheet,
          }"
          :style="dragStyle"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="!headerless ? titleId : undefined"
          :aria-label="headerless ? ariaLabel : undefined"
          tabindex="-1"
          @touchstart.passive="onTouchStart"
          @touchmove.passive="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div v-if="isSheet" class="modal__grabber" aria-hidden="true"></div>

          <div v-if="!headerless" class="modal__header">
            <h3 :id="titleId" class="modal__header-text">
              <slot name="title">Заголовок</slot>
            </h3>
            <button
              type="button"
              class="modal__close"
              aria-label="Закрыть"
              @click="modelValue = false"
            >
              <BaseIcon name="ph:x" />
            </button>
          </div>

          <div class="modal__body">
            <slot name="body" />
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
@use "../../styles/media" as *;

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 26, 40, 0.5);
  display: flex;
  flex-direction: column;
  min-height: 100%;
  z-index: 9999;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  overflow-y: auto;
  overflow-x: hidden;
  backdrop-filter: blur(3px);
}

.modal {
  background: var(--fv-color-bg-primary);
  border-radius: var(--fv-radius-lg);
  max-width: min(90vw, 500px);
  max-height: min(90vh, 100dvh);
  width: 100%;
  margin: auto;
  align-self: center;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  box-shadow: var(--fv-shadow-modal);
  border: 1px solid var(--fv-color-border);
  animation: modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

  &--detail {
    max-width: min(96vw, 720px);

    .modal__body {
      padding: 1rem 1.25rem;

      @include mediaTablet {
        padding: 1.25rem 1.75rem;
      }
    }

    .modal__footer {
      padding-top: 1rem;
      padding-bottom: 1.75rem;
    }
  }

  // Компактная форма (эталон): узкая ширина + тело без внутреннего скролла
  &--form {
    max-width: min(94vw, 520px);

    .modal__header {
      padding: 1.5rem 1.75rem 1.25rem;
    }

    .modal__body {
      max-height: none;
      padding: 1rem 1.75rem;
    }

    .modal__footer {
      padding: 1.25rem 1.75rem 1.75rem;
    }
  }

  // Без белой шапки: контент рисует свою обложку edge-to-edge (эталон — детали списка)
  &--headerless {
    max-width: min(94vw, 560px);

    .modal__body {
      padding: 0;
      // тело по высоте контента (не растягиваем — иначе пустой зазор до футера);
      // при длинном контенте flex-shrink + overflow даёт скролл
      flex: 0 1 auto;
    }

    .modal__footer {
      padding: 1rem 1.5rem 1.5rem;
      border-top: 0;
    }
  }

  // <768px — action sheet снизу (эталон): выезд снизу, скругление только сверху
  &--sheet {
    position: relative;
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    max-height: 85vh;
    border-radius: 24px 24px 0 0;
    animation: sheet-up 0.32s cubic-bezier(0.22, 0.85, 0.28, 1);
    transition: transform 0.25s ease;

    .modal__header {
      padding-top: 26px; // место под grabber
    }
  }
}

.modal-backdrop--sheet {
  justify-content: flex-end;
  padding: 0;
}

/* Grabber-хват листа */
.modal__grabber {
  position: absolute;
  top: 8px;
  left: 50%;
  z-index: 3;
  width: 40px;
  height: 5px;
  border-radius: 999px;
  background: rgba(140, 146, 158, 0.9);
  transform: translateX(-50%);
}

@keyframes sheet-up {
  from {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal,
  .modal--sheet {
    animation: none;
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: none;
  }
}

.modal__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2rem 2.5rem 1.5rem;
  border-bottom: 1px solid var(--fv-color-border);
}

.modal__header-text {
  color: var(--fv-color-text-primary);
  font-family: var(--fv-font-display);
  font-size: clamp(1.25rem, 4vw, 1.75rem);
  font-weight: 500;
  margin: 0;
}

.modal__close {
  width: 36px;
  height: 36px;
  border-radius: var(--fv-radius-sm);
  border: none;
  background: var(--fv-color-bg-secondary);
  color: var(--fv-color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--fv-color-text-primary) 8%, transparent);
    color: var(--fv-color-text-primary);
    transform: scale(1.05);
  }
}

.modal__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 16px 20px;
  max-height: min(400px, calc(100dvh - 11rem));
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.modal__footer {
  flex-shrink: 0;
  padding: 1.5rem 2.5rem 2.5rem;
  border-top: 1px solid var(--fv-color-border);
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.modal--detail .modal__body {
  max-height: none;
}

.modal__btn-cancel,
.modal__btn-confirm {
  height: 48px;
  border-radius: var(--fv-radius-sm);
  font-weight: 600;
}

.modal__btn-confirm {
  min-width: 140px;
}

/* Скрим плавно появляется и уходит (enter И leave — не мгновенно).
   Внутренний .modal делает свой «pop» через animation: modalSlideIn. */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
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

/* Поля ввода внутри модалки стилизуются глобально в styles/forms.scss
   (эталон .fld: серая заливка + синий accent-фокус). */

/* Кнопки футера крупнее — под эталон (~46px) */
.modal__footer .ant-btn {
  height: 46px;
  padding-inline: 22px;
  border-radius: var(--fv-radius-sm);
  font-weight: 500;
  font-size: 0.95rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Иконка внутри кнопки не должна липнуть к тексту */
  gap: 8px;
}

.modal--sheet .modal__footer .ant-btn {
  flex: 1;
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
