import { onBeforeUnmount, watch, type Ref } from "vue";

/**
 * Esc отменяет активное действие на странице: режим правки, раскрытую панель.
 * Слушатель живёт только пока действие активно.
 *
 * Если поверх открыт диалог, Esc отдаём ему — у модалки свой обработчик,
 * иначе одно нажатие закрыло бы и окно, и правку под ним.
 */
export function useEscapeKey(isActive: Ref<boolean>, onEscape: () => void): void {
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key !== "Escape" || document.querySelector(".modal-backdrop")) {
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
