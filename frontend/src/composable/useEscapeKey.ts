import { onBeforeUnmount, watch, type Ref } from "vue";
import { hasActiveFocusTrap } from "./useFocusTrap";

/**
 * Esc отменяет активное действие на странице: режим правки, раскрытую панель.
 * Слушатель живёт только пока действие активно.
 *
 * Если поверх открыт оверлей, Esc обрабатывает его ловушка фокуса.
 */
export function useEscapeKey(
  isActive: Ref<boolean>,
  onEscape: () => void
): void {
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key !== "Escape" || hasActiveFocusTrap()) {
      return;
    }

    onEscape();
  };

  const stop = (): void => window.removeEventListener("keydown", onKeydown);

  watch(isActive, (active) => {
    if (active) {
      window.addEventListener("keydown", onKeydown);
    } else {
      stop();
    }
  });

  onBeforeUnmount(stop);
}
