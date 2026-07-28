<script lang="ts">
// Модалки живут стеком (детали списка → подтверждение удаления): клавиатуру
// обслуживает только верхняя, иначе нижняя тянет Tab на себя, а Esc закрывает обе
const keyboardStack: ((e: KeyboardEvent) => void)[] = [];
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useScrollLock } from "@/composable/useScrollLock";

const modelValue = defineModel<boolean>();

defineProps<{
  layout?: "default" | "detail" | "form" | "quick";
  /** Скрыть стандартную белую шапку — контент сам рисует обложку (edge-to-edge) */
  headerless?: boolean;
  /** Доступное имя диалога для headerless-режима (когда нет заголовка) */
  ariaLabel?: string;
  /** Подложка: `default` — затемнение + blur(3px) по спеке, `blur` — усиленное blur(25px) */
  overlay?: "default" | "blur";
}>();
const emit = defineEmits<{ confirm: [] }>();

// Корень — Teleport, автоматически унаследовать class Vue не может (варнинг
// «Extraneous non-props attributes»), поэтому кладём атрибуты на само окно
defineOptions({ inheritAttrs: false });

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
  if (keyboardStack[keyboardStack.length - 1] !== onKeydown) {
    return;
  }

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

function startKeyboard(): void {
  keyboardStack.push(onKeydown);
  window.addEventListener("keydown", onKeydown);
}

function stopKeyboard(): void {
  window.removeEventListener("keydown", onKeydown);

  const index = keyboardStack.indexOf(onKeydown);

  if (index !== -1) {
    keyboardStack.splice(index, 1);
  }
}

function setPrevFocus() {
  previousFocus.value = document.activeElement as HTMLElement;
}

function activatePrevFocus(): void {
  // preventScroll: лок скролла снимается только после выходной анимации, и
  // доскролл браузера к кнопке-открывашке дёрнул бы страницу под уходящим окном
  previousFocus.value?.focus({ preventScroll: true });
}

// Vue уводит уходящий узел двумя путями — обычный конец анимации и форсированное
// удаление при повторном открытии, — поэтому лок снимаем по обоим. Иначе счётчик
// в useScrollLock останется на 1 и страница залипнет заблокированной
function releaseScrollLock(): void {
  if (!modelValue.value) {
    unlockScroll();
  }
}

// Лист может уходить посреди возврата после недотянутого свайпа — выходная
// анимация должна стартовать оттуда, где он сейчас, а не с нуля
function captureSheetOffset(el: Element): void {
  const sheet = el.querySelector<HTMLElement>(".modal--sheet");

  if (!sheet) {
    return;
  }

  const shift = Number(
    /matrix\([^)]+,\s*([-\d.]+)\)/.exec(getComputedStyle(sheet).transform)?.[1],
  );

  if (shift > 0) {
    sheet.style.setProperty("--fv-modal-drag", `${shift}px`);
  }
}

watch(modelValue, async (open) => {
  if (open) {
    setPrevFocus();
    lockScroll();
    dragOffset.value = 0;
    startKeyboard();
    await nextTick();
    // Фокус — после рендера, иначе .focus() ничего не сделает. preventScroll
    // обязателен: подложка скроллится, и доскролл к окну, стоящему в начальной точке
    // анимации (лист — ниже вьюпорта), гасит весь выезд встречным скроллом
    modal.value?.focus({ preventScroll: true });
  } else {
    stopKeyboard();
    activatePrevFocus();
  }
});

// Размонтирование с открытой модалкой (напр. смена роута) не проходит через watcher
// (лок скролла в этом случае освобождает onScopeDispose внутри useScrollLock)
onBeforeUnmount(stopKeyboard);

// Уходящая подложка все 200–320 мс продолжает перехватывать клики (см. стили), но
// действовать по ним не должна: без guard клик по ней слал бы второй update:modelValue
const close = (): void => {
  if (!modelValue.value) {
    return;
  }

  modelValue.value = false;
};

const handleConfirm = () => {
  emit("confirm");
};
</script>

<template>
  <!-- Без :disabled: иначе при закрытии Vue переносит ещё живой узел из body назад,
       а перенос перезапускает CSS-анимацию — окно выезжало снизу второй раз -->
  <Teleport to="body">
    <Transition
      name="modal"
      @before-leave="captureSheetOffset"
      @after-leave="releaseScrollLock"
      @leave-cancelled="releaseScrollLock"
    >
      <div
        v-if="modelValue"
        class="modal-backdrop"
        :class="{
          'modal-backdrop--sheet': isSheet,
          'modal-backdrop--blur': overlay === 'blur',
        }"
        @click.self="close"
      >
        <div
          ref="modal"
          v-bind="$attrs"
          class="modal"
          :class="{
            'modal--detail': layout === 'detail',
            'modal--form': layout === 'form',
            'modal--quick': layout === 'quick',
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
@use "@/styles/scrollbar" as *;

.modal-backdrop {
  // Спека, COMPONENTS.md §7.1. Длительность общая со скримом: он корневой узел
  // перехода, по его animationend Vue снимает подложку вместе с окном
  --fv-modal-duration: 0.2s;
  --fv-modal-ease: cubic-bezier(0.2, 0.8, 0.25, 1);

  position: fixed;
  inset: 0;
  background: rgba(20, 26, 40, 0.5);
  // Затемнение + лёгкое размытие — дефолт по спеке, не опция
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  z-index: 9999;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  overflow-y: auto;
  overflow-x: hidden;

  // Усиленное размытие — отдельный вариант оверлея (эталон Angular `_type_blur`)
  &--blur {
    backdrop-filter: blur(25px);
  }
}

.modal {
  background: var(--fv-color-bg-primary);
  border-radius: var(--fv-radius-lg);
  max-width: min(90vw, 500px);
  max-height: min(90vh, 640px);
  width: 100%;
  margin: auto;
  align-self: center;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  box-shadow: var(--fv-shadow-modal);

  &--detail {
    max-width: min(96vw, 720px);
    max-height: min(92vh, 760px);

    .modal__footer {
      padding-top: 14px;
    }
  }

  // Компактная форма (эталон): узкая ширина + тело без внутреннего скролла
  &--form {
    max-width: min(94vw, 520px);
    // Оценка со звёздами и отзывом укладывается целиком — без скролла в теле
    max-height: min(90vh, 720px);

    .modal__body {
      max-height: none;
    }
  }

  // Без белой шапки: контент рисует свою обложку edge-to-edge (эталон — детали списка)
  // Быстрый просмотр из каталога (эталон m0433)
  &--quick {
    max-width: min(94vw, 600px);
    max-height: min(92vh, 760px);

    &.modal--sheet {
      max-height: calc(100% - 56px);
    }
  }

  &--headerless {
    max-width: min(94vw, 560px);

    .modal__body {
      padding: 0;
      // тело по высоте контента (не растягиваем — иначе пустой зазор до футера);
      // при длинном контенте flex-shrink + overflow даёт скролл
      flex: 0 1 auto;
    }

    .modal__footer {
      padding-top: 16px;
      border-top: 0;
    }
  }

  // <768px — action sheet снизу (эталон): выезд снизу, скругление только сверху
  &--sheet {
    position: relative;
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    // 85% от подложки, а не 85vh (спека §7.1 — тоже проценты): на мобильном Safari
    // vh считается по «большому» вьюпорту, и лист занимал бы всю видимую высоту
    max-height: 85%;
    border-radius: 24px 24px 0 0;
    // возврат листа на место, если свайп не дотянул до порога закрытия
    transition: transform 0.25s var(--fv-ease);

    // Боковые отступы листа по спеке — 22px (у центрированного диалога 24px)
    .modal__header,
    .modal__body {
      padding-left: 22px;
      padding-right: 22px;
    }

    .modal__header {
      padding-top: 26px; // место под grabber
    }

    .modal__footer {
      padding: 8px 22px 30px;
      border-top: 0;
    }

    .modal__close {
      width: 34px;
      height: 34px;
    }
  }

  // headerless рисует обложку edge-to-edge — боковые отступы тела снимаем и на листе
  &--headerless.modal--sheet .modal__body {
    padding-left: 0;
    padding-right: 0;
  }
}

.modal-backdrop--sheet {
  // Лист едет на всю свою высоту — своя пара «длительность + кривая» по спеке §7.1
  // (`slideUp .32s cubic-bezier(.22,.85,.28,1)`)
  --fv-modal-duration: 0.32s;
  --fv-modal-ease: cubic-bezier(0.22, 0.85, 0.28, 1);

  justify-content: flex-end;
  padding: 0;
  // Скроллить подложке нечего (скролл внутри .modal__body), а вред есть: любой сдвиг
  // листа вниз даёт подложке оверфлоу, который браузер норовит подкрутить — это гасит
  // анимацию и даёт «резину» под пальцем
  overflow: hidden;
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
  background: var(--fv-palette-grey-400);
  transform: translateX(-50%);
}

/* Анимации только внутри классов перехода: постоянная `animation` на элементе
   проигрывается заново при каждой вставке узла в DOM. Скрим тоже на `animation`, а не
   `transition` — так у него с окном общий кадр старта, и Vue ждёт animationend. */
.modal-enter-active {
  animation: fv-scrim-in var(--fv-modal-duration) ease both;
}

.modal-leave-active {
  animation: fv-scrim-out var(--fv-modal-duration) ease both;
}

/* Уходящая подложка продолжает ловить клики (под ней деструктивные действия —
   удалить список, выйти из аккаунта), но окно на клики больше не отвечает: иначе
   второй клик по «Удалить» отправил бы действие дважды за время анимации */
.modal-leave-active .modal {
  pointer-events: none;
}

.modal-enter-active .modal:not(.modal--sheet) {
  animation: fv-modal-in var(--fv-modal-duration) var(--fv-modal-ease) both;
}

.modal-leave-active .modal:not(.modal--sheet) {
  animation: fv-modal-out var(--fv-modal-duration) var(--fv-modal-ease) both;
}

.modal-enter-active .modal--sheet {
  animation: fv-sheet-in var(--fv-modal-duration) var(--fv-modal-ease) both;
}

.modal-leave-active .modal--sheet {
  animation: fv-sheet-out var(--fv-modal-duration) var(--fv-modal-ease) both;
}

@keyframes fv-scrim-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fv-scrim-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* Смещение в px, а не в %: процент считается от высоты окна, и «Удалить?» с detail
   ехали бы на разное расстояние. Порядок transform-функций в from и to одинаковый —
   иначе интерполяция идёт через матрицу и путь ломается */
@keyframes fv-modal-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes fv-modal-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
}

@keyframes fv-sheet-in {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes fv-sheet-out {
  /* стартовую точку проставляет captureSheetOffset, если лист был сдвинут свайпом */
  from {
    transform: translateY(var(--fv-modal-drag, 0px));
  }
  to {
    transform: translateY(100%);
  }
}

.modal__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 18px;
}

.modal__header-text {
  color: var(--fv-color-text-primary);
  font-family: var(--fv-font-ui);
  font-size: var(--fv-text-h4-size);
  line-height: var(--fv-text-h4-lh);
  font-weight: 500;
  margin: 0;
}

.modal__close {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: var(--fv-color-bg-secondary);
  color: var(--fv-color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--fv-motion-slow) var(--fv-ease);

  &:hover {
    background: color-mix(in srgb, var(--fv-color-text-primary) 8%, transparent);
    color: var(--fv-color-text-primary);
    transform: scale(1.05);
  }
}

.modal__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 24px;
  max-height: none;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  @include customScrollbar();
}

.modal__footer {
  flex-shrink: 0;
  padding: 18px 24px 24px;
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
  border-radius: var(--fv-radius-control);
  font-weight: 500;
}

.modal__btn-confirm {
  min-width: 140px;
}

/* Поля ввода внутри модалки стилизуются глобально в styles/forms.scss
   (эталон .fld: серая заливка + синий accent-фокус). */

/* Кнопки футера крупнее — под эталон (~46px) */
.modal__footer .ant-btn {
  height: 46px;
  padding-inline: 22px;
  border-radius: var(--fv-radius-control);
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

/* Ниже боевых правил и с той же специфичностью — иначе анимация не отключится.
   `animation: none` на скриме заодно снимает ожидание: Vue не находит ни transition,
   ни animation и убирает узел сразу, не задерживая снятие лока скролла */
@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active .modal:not(.modal--sheet),
  .modal-leave-active .modal:not(.modal--sheet),
  .modal-enter-active .modal--sheet,
  .modal-leave-active .modal--sheet {
    animation: none;
  }

  .modal--sheet {
    transition: none;
  }
}
</style>
