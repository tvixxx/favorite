import { onBeforeUnmount, watch, type Ref } from "vue";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ловушка фокуса для оверлеев: пока панель открыта, Tab не выпускает фокус на фон,
 * Esc закрывает, а после закрытия фокус возвращается на элемент-открывашку.
 */
export function useFocusTrap(
  container: Ref<HTMLElement | null>,
  isOpen: Ref<boolean | undefined>,
  onEscape: () => void,
): void {
  let previousFocus: HTMLElement | null = null;

  const getFocusable = (): HTMLElement[] => {
    if (!container.value) {
      return [];
    }

    return Array.from(
      container.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => el.offsetParent !== null);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      onEscape();

      return;
    }

    if (e.key !== "Tab" || !container.value) {
      return;
    }

    const focusable = getFocusable();
    const active = document.activeElement as HTMLElement | null;

    if (focusable.length === 0) {
      e.preventDefault();
      container.value.focus();

      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (!active || !container.value.contains(active)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const stop = (): void => window.removeEventListener("keydown", onKeydown);

  watch(isOpen, (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement;
      window.addEventListener("keydown", onKeydown);
    } else {
      stop();
      // preventScroll: панель ещё уезжает, доскролл к открывашке дёрнул бы страницу
      previousFocus?.focus({ preventScroll: true });
    }
  });

  onBeforeUnmount(stop);
}
