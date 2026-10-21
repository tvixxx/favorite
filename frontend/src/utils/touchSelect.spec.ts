import { afterEach, describe, expect, it, vi } from "vitest";
import { blurAfterTouchSelect, selectPopupContainer } from "./touchSelect";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("Выбор значения на сенсорном устройстве", () => {
  it("снимает фокус после выбора, чтобы закрыть клавиатуру", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));

    const input = document.createElement("input");

    document.body.append(input);
    input.focus();
    await blurAfterTouchSelect();
    expect(document.activeElement).not.toBe(input);
  });

  it("сохраняет фокус при работе с настольной клавиатурой", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));

    const input = document.createElement("input");

    document.body.append(input);
    input.focus();
    await blurAfterTouchSelect();
    expect(document.activeElement).toBe(input);
  });

  it("выносит список из прокручиваемого тела модалки в её видимую подложку", () => {
    document.body.innerHTML =
      '<div class="modal-backdrop"><div class="modal__body"><input /></div></div>';

    expect(selectPopupContainer(document.querySelector("input")!)).toBe(
      document.querySelector(".modal-backdrop")
    );

    expect(selectPopupContainer(document.createElement("input"))).toBe(
      document.body
    );
  });
});
