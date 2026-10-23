import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import type { Config, Driver } from "driver.js";
import type { Router } from "vue-router";
import { createOnboardingDriver } from "./createOnboardingDriver";

const mocks = vi.hoisted(() => ({ driver: vi.fn() }));

vi.mock("driver.js", () => ({ driver: mocks.driver }));

let config: Config;
let index: number;
let moveTo: ReturnType<typeof vi.fn>;
let router: Router;

function target(title: string): Element | undefined {
  const element = config.steps!.find(
    (step) => step.popover?.title === title
  )?.element;

  return typeof element === "function" ? element() : undefined;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0)
  );

  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
    function (this: HTMLElement) {
      return (this.style.display === "none"
        ? []
        : [new DOMRect(10, 10, 100, 40)]) as unknown as DOMRectList;
    }
  );

  HTMLElement.prototype.scrollIntoView = vi.fn();
  index = 7;
  moveTo = vi.fn((value: number) => {
    index = value;
  });

  mocks.driver.mockImplementation((value: Config) => {
    config = value;

    return {
      moveTo,
      getActiveIndex: () => index,
      destroy: vi.fn(),
    } as unknown as Driver;
  });

  const currentRoute = { value: { path: "/profile", fullPath: "/profile" } };

  router = {
    currentRoute,
    push: vi.fn(async (path: string) => {
      currentRoute.value = { path: path.split("?")[0], fullPath: path };
      if (!path.startsWith("/profile/settings")) return;
      document.body.innerHTML = path.endsWith("section=notifications")
        ? '<div class="additional-settings__content"><section data-tour="notification-settings"></section></div>'
        : '<div class="additional-settings__content"><section data-tour="personal-settings"><div data-tour="setting-quickAddEnabled"></div><div data-tour="setting-watchTonightEnabled"></div><div data-tour="setting-collectionFilesEnabled"></div></section></div>';
    }),
  } as unknown as Router;

  document.body.innerHTML = '<button data-tour="profile-settings"></button>';

  createOnboardingDriver(router, { onCompleted: vi.fn() });
});

afterEach(() => {
  document.body.innerHTML = "";
  document.body.classList.remove("fv-tour-transitioning");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Переходы интерактивного тура", () => {
  it("делает рамку фильтров прямой и возвращает скругления на соседнем шаге", () => {
    const setConfig = vi.fn();
    const context = {
      driver: { setConfig, getConfig: () => config },
    } as never;
    const filters = document.createElement("div");

    filters.className = "collection-filters__row";
    config.onHighlightStarted?.(filters, config.steps![3], context);
    expect(setConfig).toHaveBeenLastCalledWith(
      expect.objectContaining({ stageRadius: 0 })
    );

    config.onHighlightStarted?.(
      document.createElement("article"),
      config.steps![4],
      context
    );

    expect(setConfig).toHaveBeenLastCalledWith(
      expect.objectContaining({ stageRadius: 14 })
    );
  });

  it("открывает персональную категорию отдельной страницы и выделяет конкретный переключатель", async () => {
    config.steps![7].popover!.onNextClick?.(
      undefined,
      config.steps![7],
      {} as never
    );

    await vi.runAllTimersAsync();
    expect(router.push).toHaveBeenCalledWith(
      "/profile/settings?section=personal"
    );

    expect(moveTo).toHaveBeenCalledWith(8);
    expect(target("Быстрый ввод")).toBe(
      document.querySelector('[data-tour="setting-quickAddEnabled"]')
    );

    expect(target("Что посмотреть сегодня")).toBe(
      document.querySelector('[data-tour="setting-watchTonightEnabled"]')
    );

    expect(target("Импорт и экспорт")).toBe(
      document.querySelector('[data-tour="setting-collectionFilesEnabled"]')
    );

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      behavior: "instant",
    });
  });

  it("переключает категорию уведомлений на той же странице вместо поиска в старой модалке", async () => {
    config.steps![7].popover!.onNextClick?.(
      undefined,
      config.steps![7],
      {} as never
    );

    await vi.runAllTimersAsync();
    index = 10;
    config.steps![10].popover!.onNextClick?.(
      undefined,
      config.steps![10],
      {} as never
    );

    await vi.runAllTimersAsync();
    expect(router.push).toHaveBeenLastCalledWith(
      "/profile/settings?section=notifications"
    );

    expect(moveTo).toHaveBeenLastCalledWith(11);
    expect(target("Какие уведомления показывать")).toBe(
      document.querySelector('[data-tour="notification-settings"]')
    );

    expect(document.querySelector(".profile-settings-modal")).toBeNull();
  });

  it("не дублирует переход при быстрых повторных нажатиях", async () => {
    const next = config.steps![7].popover!.onNextClick!;

    next(undefined, config.steps![7], {} as never);
    next(undefined, config.steps![7], {} as never);
    await vi.runAllTimersAsync();
    expect(moveTo).toHaveBeenCalledTimes(1);
  });

  it("на низком экране продолжает подсвечивать отдельную настройку, а не весь длинный раздел", async () => {
    config.steps![7].popover!.onNextClick?.(
      undefined,
      config.steps![7],
      {} as never
    );

    await vi.runAllTimersAsync();

    const body = document.querySelector(".additional-settings__content")!;

    Object.defineProperty(body, "clientHeight", { value: 140 });
    expect(target("Быстрый ввод")).not.toBe(body);
    expect(target("Быстрый ввод")?.getAttribute("data-tour")).toBe(
      "setting-quickAddEnabled"
    );
  });

  it("ждёт карточку каталога на новом маршруте и не подменяет её поиском", async () => {
    index = 3;
    document.body.innerHTML = '<input data-tour="catalog-filters" />';

    const navigating = vi.fn(async () => {
      await nextTick();
      setTimeout(
        () =>
          document.body.insertAdjacentHTML(
            "beforeend",
            '<div data-tour="catalog-grid"><article id="movie-card"></article></div>'
          ),
        600
      );
    });

    router.push = navigating as unknown as Router["push"];
    config.steps![3].popover!.onNextClick?.(
      undefined,
      config.steps![3],
      {} as never
    );

    expect(moveTo).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(navigating).toHaveBeenCalledWith("/library/catalog");
    expect(moveTo).toHaveBeenCalledWith(4);
    expect(target("Каталог произведений")).toBe(
      document.querySelector("#movie-card")
    );
  });

  it("ждёт медленный каталог и постер, а не переходит к пустой рамке через пять секунд", async () => {
    index = 3;
    document.body.innerHTML =
      '<div aria-busy="true"><div data-tour="catalog-grid"><article id="ready-card"><img /></article></div></div>';

    const image = document.querySelector("img")!;

    Object.defineProperty(image, "complete", { value: false });
    config.steps![3].popover!.onNextClick?.(
      undefined,
      config.steps![3],
      {} as never
    );

    await vi.advanceTimersByTimeAsync(12000);
    expect(moveTo).not.toHaveBeenCalled();
    document.querySelector("[aria-busy]")!.setAttribute("aria-busy", "false");
    await vi.advanceTimersByTimeAsync(20);
    expect(moveTo).not.toHaveBeenCalled();
    image.dispatchEvent(new Event("load"));
    await vi.runAllTimersAsync();
    expect(moveTo).toHaveBeenCalledWith(4);
    expect(target("Каталог произведений")).toBe(
      document.querySelector("#ready-card")
    );
  });

  it.each(["error", "abort"])(
    "завершает ожидание постера при %s",
    async (event) => {
      index = 3;
      document.body.innerHTML =
        '<div data-tour="catalog-grid"><article><img /></article></div>';

      const image = document.querySelector("img")!;

      Object.defineProperty(image, "complete", { value: false });
      config.steps![3].popover!.onNextClick?.(
        undefined,
        config.steps![3],
        {} as never
      );

      await vi.advanceTimersByTimeAsync(20);
      expect(moveTo).not.toHaveBeenCalled();
      if (event === "abort")
        config.onDestroyed?.(undefined, {} as never, {} as never);
      else image.dispatchEvent(new Event("error"));
      await vi.runAllTimersAsync();
      if (event === "abort") expect(moveTo).not.toHaveBeenCalled();
      else expect(moveTo).toHaveBeenCalledWith(4);
    }
  );

  it("скрывает старую подсветку до подтверждения отрисовки нового шага", async () => {
    index = 3;
    document.body.innerHTML = '<div data-tour="catalog-grid"><article /></div>';
    config.steps![3].popover!.onNextClick?.(
      undefined,
      config.steps![3],
      {} as never
    );

    expect(document.body.classList.contains("fv-tour-transitioning")).toBe(
      true
    );

    config.onHighlighted?.(undefined, config.steps![3], {} as never);
    expect(document.body.classList.contains("fv-tour-transitioning")).toBe(
      true
    );

    await vi.runAllTimersAsync();
    expect(moveTo).toHaveBeenCalledWith(4);
    expect(document.body.classList.contains("fv-tour-transitioning")).toBe(
      true
    );

    config.onHighlighted?.(
      document.querySelector("article")!,
      config.steps![4],
      {} as never
    );

    expect(document.body.classList.contains("fv-tour-transitioning")).toBe(
      false
    );
  });

  it("снимает скрытие и закрывает тур при ошибке перехода", async () => {
    index = 3;
    router.push = vi.fn().mockRejectedValue(new Error("navigation failed"));
    config.steps![3].popover!.onNextClick?.(
      undefined,
      config.steps![3],
      {} as never
    );

    await vi.runAllTimersAsync();
    expect(document.body.classList.contains("fv-tour-transitioning")).toBe(
      false
    );

    expect(moveTo).not.toHaveBeenCalled();
  });

  it("при закрытии тура отменяет ожидающий переход", async () => {
    index = 3;
    config.steps![3].popover!.onNextClick?.(
      undefined,
      config.steps![3],
      {} as never
    );

    config.onDestroyed?.(undefined, {} as never, {} as never);
    await vi.runAllTimersAsync();
    expect(moveTo).not.toHaveBeenCalled();
  });
});
