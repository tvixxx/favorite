import { onBeforeUnmount, watch, type Ref } from "vue";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: ((event: KeyboardEvent) => void)[] = [];

export function hasActiveFocusTrap(): boolean {
  return stack.length > 0;
}

function handleKeydown(event: KeyboardEvent): void {
  stack[stack.length - 1]?.(event);
}

/**
 * Ловушка фокуса для оверлеев: пока панель открыта, Tab не выпускает фокус на фон,
 * Esc закрывает, а после закрытия фокус возвращается на элемент-открывашку.
 */
export function useFocusTrap(
  container: Ref<HTMLElement | null>,
  isOpen: Ref<boolean | undefined>,
  onEscape: () => void
): void {
  let previousFocus: HTMLElement | null = null;

  const getFocusable = (): HTMLElement[] => {
    if (!container.value) {
      return [];
    }

    return Array.from(
      container.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
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

  function stop(): boolean {
    const index = stack.indexOf(onKeydown);

    if (index === -1) return false;

    const wasTop = index === stack.length - 1;

    stack.splice(index, 1);
    if (!stack.length) window.removeEventListener("keydown", handleKeydown);

    return wasTop;
  }

  watch(
    isOpen,
    (open) => {
      if (open) {
        previousFocus = document.activeElement as HTMLElement | null;
        if (!stack.length) window.addEventListener("keydown", handleKeydown);
        stack.push(onKeydown);
      } else if (stop()) {
        // The closing transition still holds the scroll lock.
        previousFocus?.focus({ preventScroll: true });
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(stop);
}
