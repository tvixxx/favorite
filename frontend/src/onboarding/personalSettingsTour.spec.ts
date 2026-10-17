import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config, Driver } from "driver.js";
import type { Router } from "vue-router";
import { createOnboardingDriver } from "./createOnboardingDriver";

const mocks = vi.hoisted(() => ({ driver: vi.fn() }));
vi.mock("driver.js", () => ({ driver: mocks.driver }));

let config: Config;
let section: HTMLElement;
let body: HTMLElement;
let moveNext: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  document.body.innerHTML = `<button data-tour="profile-settings"></button>
    <div class="profile-settings-modal"><div class="modal__body">
      <section data-tour="personal-settings"></section>
    </div></div>`;
  section = document.querySelector("section")!;
  body = document.querySelector(".modal__body")!;
  Object.defineProperty(section, "offsetParent", { get: () => body });
  vi.spyOn(section, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 200, 400, 278));
  Object.defineProperty(body, "clientHeight", { configurable: true, value: 500 });
  section.scrollIntoView = vi.fn();
  moveNext = vi.fn();
  mocks.driver.mockImplementation((value: Config) => {
    config = value;

    return { moveNext } as unknown as Driver;
  });
  createOnboardingDriver({} as Router, { onCompleted: vi.fn() });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function highlightedElement(): Element | undefined {
  const element = config.steps![8].element;

  return typeof element === "function" ? element() : undefined;
}

describe("Подсветка персональных настроек в туре", () => {
  it("на обычном экране выделяет только блок переключателей", () => {
    expect(highlightedElement()).toBe(section);
  });

  it("на низком экране ограничивает рамку видимой областью без футера", () => {
    Object.defineProperty(body, "clientHeight", { value: 140 });
    expect(highlightedElement()).toBe(body);
  });

  it("перед переходом к переключателям прокручивает их в видимую область", async () => {
    let scrolledBeforeHighlight = false;
    moveNext.mockImplementation(() => {
      scrolledBeforeHighlight = vi.mocked(section.scrollIntoView).mock.calls.some(([options]) =>
        typeof options === "object" && options.block === "start" && options.behavior === "instant",
      );
    });
    const showSettings = config.steps![7].popover!.onNextClick as () => Promise<void>;
    const transition = showSettings();
    await vi.runAllTimersAsync();
    await transition;
    expect(moveNext).toHaveBeenCalledOnce();
    expect(scrolledBeforeHighlight).toBe(true);
  });
});
