import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVisualViewport } from "./useVisualViewport";

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(available = true) {
  const viewport = Object.assign(new EventTarget(), {
    height: 800,
    offsetTop: 0,
    scale: 1,
  });

  vi.stubGlobal("visualViewport", available ? viewport : undefined);

  const wrapper = mount(
    defineComponent({
      setup() {
        const style = useVisualViewport();

        return () => h("nav", { style: style.value });
      },
    })
  );

  mounted.push(wrapper);

  return { viewport, wrapper, nav: wrapper.element as HTMLElement };
}

describe("Модальное окно в видимой области", () => {
  it("уменьшает доступную область при клавиатуре и восстанавливает после закрытия", async () => {
    const { viewport, nav } = setup();

    await nextTick();
    expect(nav.style.top).toBe("0px");
    expect(nav.style.bottom).toBe("auto");
    expect(nav.style.height).toBe("800px");

    viewport.height = 360;
    viewport.offsetTop = 120;
    viewport.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(nav.style.top).toBe("120px");
    expect(nav.style.height).toBe("360px");

    viewport.height = 800;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(nav.style.top).toBe("0px");
    expect(nav.style.height).toBe("800px");
  });

  it("учитывает смещение и последующую прокрутку без сброса страницы", async () => {
    const { viewport, nav } = setup();
    const scroll = vi.spyOn(window, "scrollTo");

    viewport.height = 776;
    viewport.offsetTop = 24;
    viewport.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(nav.style.top).toBe("24px");
    expect(nav.style.height).toBe("776px");

    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(nav.style.top).toBe("0px");
    expect(scroll).not.toHaveBeenCalled();

    viewport.height = 390;
    viewport.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(nav.style.height).toBe("390px");
  });

  it("сохраняет обычный CSS при масштабировании и восстанавливает привязку", async () => {
    const { viewport, nav } = setup();

    await nextTick();
    viewport.scale = 2;
    viewport.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(nav.style.cssText).toBe("");

    viewport.scale = 1;
    viewport.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(nav.style.height).toBe("800px");
  });

  it("сохраняет исходные стили без поддержки VisualViewport", async () => {
    const { nav } = setup(false);

    await nextTick();
    expect(nav.hasAttribute("style")).toBe(false);
  });

  it("снимает обработчики при уничтожении окна", () => {
    const { viewport, wrapper } = setup();
    const viewportOff = vi.spyOn(viewport, "removeEventListener");

    wrapper.unmount();
    expect(viewportOff).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(viewportOff).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
