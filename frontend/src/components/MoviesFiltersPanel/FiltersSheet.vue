<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useScrollLock } from "@/composable/useScrollLock";
import { useFocusTrap } from "@/composable/useFocusTrap";

/**
 * Панель фильтров. До 768px — нижний action sheet (эталон), шире — правая шторка.
 */
const open = defineModel<boolean>();

defineProps<{
  /** Сколько фильтров применено — счётчик в шапке */
  activeCount: number;
  /** Сколько тайтлов найдено — число в кнопке «Показать» */
  resultCount?: number;
}>();

const emit = defineEmits<{ reset: [] }>();

const isSheet = useMediaQuery("(max-width: 767.98px)");

const panel = ref<HTMLElement | null>(null);
const dragOffset = ref(0);
const dragStartY = ref<number | null>(null);
const dragActive = ref(false);

const close = (): void => {
  open.value = false;
};

const { lock: lockScroll, unlock: unlockScroll } = useScrollLock();

useFocusTrap(panel, open, close);

watch(open, async (isOpen) => {
  if (!isOpen) {
    return;
  }

  lockScroll();
  dragOffset.value = 0;
  await nextTick();
  // preventScroll: панель в этом кадре ещё за краем экрана, доскролл к ней сорвёт выезд
  panel.value?.focus({ preventScroll: true });
});

const releaseScrollLock = (): void => {
  if (!open.value) {
    unlockScroll();
  }
};

const onTouchStart = (e: TouchEvent): void => {
  if (!isSheet.value) {
    return;
  }

  const body = panel.value?.querySelector(".fsheet__body");

  dragActive.value = !body || body.scrollTop <= 0;
  dragStartY.value = e.touches[0]?.clientY ?? null;
};

const onTouchMove = (e: TouchEvent): void => {
  if (!dragActive.value || dragStartY.value === null) {
    return;
  }

  dragOffset.value = Math.max(
    0,
    (e.touches[0]?.clientY ?? 0) - dragStartY.value,
  );
};

const onTouchEnd = (): void => {
  if (dragOffset.value > 90) {
    close();
  }

  dragOffset.value = 0;
  dragStartY.value = null;
  dragActive.value = false;
};
</script>

<template>
  <Teleport to="body">
    <Transition name="fsheet" @after-leave="releaseScrollLock">
      <div
        v-if="open"
        class="fsheet-scrim"
        :class="{ 'fsheet-scrim--sheet': isSheet }"
        @click.self="close"
      >
        <aside
          ref="panel"
          class="fsheet"
          :class="{ 'fsheet--sheet': isSheet }"
          :style="
            dragOffset > 0
              ? { transform: `translateY(${dragOffset}px)`, transition: 'none' }
              : undefined
          "
          role="dialog"
          aria-modal="true"
          aria-label="Фильтры"
          tabindex="-1"
          @touchstart.passive="onTouchStart"
          @touchmove.passive="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div v-if="isSheet" class="fsheet__grabber" aria-hidden="true"></div>

          <header class="fsheet__head">
            <h2 class="fsheet__title">Фильтры</h2>
            <span v-if="activeCount" class="fsheet__count">
              {{ activeCount }}
            </span>

            <button
              v-if="isSheet"
              type="button"
              class="fsheet__reset"
              :disabled="!activeCount"
              @click="emit('reset')"
            >
              Сбросить
            </button>
            <button
              v-else
              type="button"
              class="fsheet__close"
              aria-label="Закрыть фильтры"
              @click="close"
            >
              <BaseIcon name="ph:x" :width="18" :height="18" />
            </button>
          </header>

          <div class="fsheet__body">
            <slot />
          </div>

          <footer class="fsheet__foot">
            <button
              v-if="!isSheet"
              type="button"
              class="fsheet__ghost"
              :disabled="!activeCount"
              @click="emit('reset')"
            >
              Сбросить
            </button>
            <button type="button" class="fsheet__apply" @click="close">
              <BaseIcon name="ph:check" :width="18" :height="18" />
              Показать{{ resultCount === undefined ? "" : ` ${resultCount}` }}
            </button>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss">
@use "@/styles/scrollbar" as *;

.fsheet-scrim {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  justify-content: flex-end;
  background: rgba(20, 26, 40, 0.5);
  backdrop-filter: blur(3px);

  &--sheet {
    align-items: flex-end;
  }
}

.fsheet {
  display: flex;
  flex-direction: column;
  width: 420px;
  max-width: 100%;
  height: 100%;
  background: var(--fv-color-bg-primary);
  box-shadow: var(--fv-shadow-high);
  text-align: left;

  &--sheet {
    width: 100%;
    height: auto;
    max-height: 85%;
    border-radius: var(--fv-radius-lg) var(--fv-radius-lg) 0 0;
    transition: transform 0.25s var(--fv-ease);
  }

  &__grabber {
    align-self: center;
    width: 40px;
    height: 5px;
    margin-top: 8px;
    border-radius: 999px;
    background: var(--fv-palette-grey-400);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--fv-color-border);
  }

  &--sheet &__head {
    padding-top: 12px;
  }

  &__title {
    margin: 0;
    font-family: var(--fv-font-display);
    font-size: 19px;
    font-weight: 700;
    color: var(--fv-color-text-primary);
  }

  // Счётчик применённых фильтров — синяя пилюля рядом с заголовком (эталон)
  &__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 7px;
    border-radius: 999px;
    background: var(--fv-color-bg-active-soft);
    color: var(--fv-color-link);
    font-size: 13px;
    font-weight: 500;
  }

  &__reset {
    margin-left: auto;
    padding: 0;
    border: 0;
    background: none;
    color: var(--fv-color-link);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;

    &:disabled {
      color: var(--fv-color-text-tertiary);
      cursor: default;
    }
  }

  &__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-left: auto;
    border: 0;
    border-radius: 50%;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-secondary);
    cursor: pointer;

    &:hover {
      color: var(--fv-color-text-primary);
    }
  }

  &__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 16px 20px;
    overflow-y: auto;

    @include customScrollbar();
  }

  &__foot {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
    padding: 14px 20px;
    border-top: 1px solid var(--fv-color-border);
  }

  &--sheet &__foot {
    padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  }

  &__ghost,
  &__apply {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 48px;
    border: 0;
    border-radius: var(--fv-radius-control);
    font: inherit;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
  }

  &__ghost {
    flex: 1;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);

    &:disabled {
      color: var(--fv-color-text-tertiary);
      cursor: default;
    }
  }

  &__apply {
    flex: 2;
    background: var(--fv-color-brand);
    color: #fff;
  }
}

/* Шторка выезжает справа, лист — снизу. Анимации живут в классах перехода:
   постоянная animation на элементе перезапускается при вставке узла в DOM */
.fsheet-enter-active,
.fsheet-leave-active {
  animation: fsheet-scrim-in 0.24s ease both;
}

.fsheet-leave-active {
  animation-name: fsheet-scrim-out;
}

.fsheet-enter-active .fsheet {
  animation: fsheet-slide-in 0.24s cubic-bezier(0.2, 0.8, 0.25, 1) both;
}

.fsheet-leave-active .fsheet {
  animation: fsheet-slide-out 0.24s cubic-bezier(0.2, 0.8, 0.25, 1) both;
}

.fsheet-enter-active .fsheet--sheet {
  animation: fsheet-up-in 0.32s cubic-bezier(0.22, 0.85, 0.28, 1) both;
}

.fsheet-leave-active .fsheet--sheet {
  animation: fsheet-up-out 0.32s cubic-bezier(0.22, 0.85, 0.28, 1) both;
}

@keyframes fsheet-scrim-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fsheet-scrim-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes fsheet-slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes fsheet-slide-out {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
}

@keyframes fsheet-up-in {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes fsheet-up-out {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fsheet-enter-active,
  .fsheet-leave-active,
  .fsheet-enter-active .fsheet,
  .fsheet-leave-active .fsheet,
  .fsheet-enter-active .fsheet--sheet,
  .fsheet-leave-active .fsheet--sheet {
    animation: none;
  }
}
</style>
