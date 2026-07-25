import { onScopeDispose } from "vue";

/**
 * Блокировка скролла страницы БЕЗ сдвига лейаута.
 *
 * Портирован подход `@angular/cdk` `BlockScrollStrategy` (лок «на <html>»):
 *  - `overflow-y: scroll` на `<html>` всегда резервирует жёлоб скроллбара, поэтому
 *    когда контент перестаёт переполнять вьюпорт — сдвига по горизонтали нет;
 *  - `position: fixed` + `top/left = -scroll` удерживают визуальную позицию
 *    (страница не прыгает вверх, как это делает голый `position: fixed`);
 *  - при разблокировке восстанавливаем инлайновые стили и `window.scroll`.
 *
 * Классические скроллбары (Windows/Linux) — жёлоб зарезервирован; overlay-скроллбары
 * (macOS по умолчанию) — резервировать нечего, но и сдвига там изначально нет.
 *
 * Реализация ссылочно-считающая: несколько одновременно открытых оверлеев
 * (модалка поверх модалки) держат один лок; страница разблокируется, когда
 * закрылся последний.
 */

const SCROLL_BLOCK_CLASS = "fv-scroll-block";

let lockCount = 0;
let applied = false;
let previousScrollTop = 0;
let previousScrollLeft = 0;
let previousHtmlTop = "";
let previousHtmlLeft = "";

function canBeEnabled(): boolean {
  const html = document.documentElement;

  if (html.classList.contains(SCROLL_BLOCK_CLASS)) {
    return false;
  }

  return (
    html.scrollHeight > html.clientHeight || html.scrollWidth > html.clientWidth
  );
}

function enable(): void {
  if (!canBeEnabled()) {
    return;
  }

  const html = document.documentElement;

  previousScrollTop = window.scrollY;
  previousScrollLeft = window.scrollX;
  previousHtmlTop = html.style.top;
  previousHtmlLeft = html.style.left;

  html.style.top = `${-previousScrollTop}px`;
  html.style.left = `${-previousScrollLeft}px`;
  html.classList.add(SCROLL_BLOCK_CLASS);

  applied = true;
}

function disable(): void {
  if (!applied) {
    return;
  }

  const html = document.documentElement;
  const body = document.body;
  const prevHtmlBehavior = html.style.scrollBehavior;
  const prevBodyBehavior = body.style.scrollBehavior;

  html.style.top = previousHtmlTop;
  html.style.left = previousHtmlLeft;
  html.classList.remove(SCROLL_BLOCK_CLASS);

  // Мгновенное восстановление позиции: глушим smooth-scroll, чтобы не было рывка.
  html.style.scrollBehavior = "auto";
  body.style.scrollBehavior = "auto";
  window.scroll(previousScrollLeft, previousScrollTop);
  html.style.scrollBehavior = prevHtmlBehavior;
  body.style.scrollBehavior = prevBodyBehavior;

  applied = false;
}

/**
 * Композабл управления блокировкой скролла. Возвращает идемпотентные `lock`/`unlock`
 * (повторный вызов из одного инстанса не удваивает счётчик) и авто-освобождает лок,
 * если компонент уничтожен с открытым оверлеем.
 */
export function useScrollLock(): { lock: () => void; unlock: () => void } {
  let held = false;

  const lock = (): void => {
    if (held) {
      return;
    }

    held = true;
    lockCount += 1;

    if (lockCount === 1) {
      enable();
    }
  };

  const unlock = (): void => {
    if (!held) {
      return;
    }

    held = false;
    lockCount = Math.max(0, lockCount - 1);

    if (lockCount === 0) {
      disable();
    }
  };

  onScopeDispose(unlock);

  return { lock, unlock };
}
