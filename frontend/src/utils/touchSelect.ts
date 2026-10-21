import { nextTick } from "vue";

export async function blurAfterTouchSelect(): Promise<void> {
  if (!window.matchMedia?.("(pointer: coarse)")?.matches) return;

  const input = document.activeElement;

  await nextTick();
  if (input instanceof HTMLInputElement && document.activeElement === input)
    input.blur();
}

export function selectPopupContainer(trigger: HTMLElement): HTMLElement {
  return trigger.closest<HTMLElement>(".modal-backdrop") ?? document.body;
}
