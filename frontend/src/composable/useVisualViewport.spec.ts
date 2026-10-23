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
        const style = useVisualViewport("bottom");

        return () => h("nav", { style: style.value });
      },
    })
  );

  mounted.push(wrapper);

  return { viewport, wrapper, nav: wrapper.element as HTMLElement };
}

describe("Нижняя панель в видимой области", () => {
  it("следует за клавиатурой и возвращается вниз после её закрытия", async () => {
    const { viewport, nav } = setup();

    await nextTick();
    expect(nav.style.top).toBe("800px");
    expect(nav.style.bottom).toBe("auto");
    expect(nav.style.height).toBe("");
    expect(nav.style.transform).toBe("translateY(-100%)");

    viewport.height = 360;
    viewport.offsetTop = 120;
    viewport.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(nav.style.top).toBe("480px");

    viewport.height = 800;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(nav.style.top).toBe("800px");
  });

  it("учитывает смещение и последующую прокрутку без сброса страницы", async () => {
    const { viewport, nav } = setup();
    const scroll = vi.spyOn(window, "scrollTo");

    viewport.height = 776;
    viewport.offsetTop = 24;
    viewport.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(nav.style.top).toBe("800px");

    viewport.offsetTop = 0;
    window.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(nav.style.top).toBe("776px");
    expect(scroll).not.toHaveBeenCalled();

    viewport.height = 390;
    window.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(nav.style.top).toBe("390px");
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
    expect(nav.style.top).toBe("800px");
  });

  it("сохраняет CSS bottom: 0 без поддержки VisualViewport", async () => {
    const { nav } = setup(false);

    await nextTick();
    expect(nav.hasAttribute("style")).toBe(false);
  });

  it("снимает обработчики при уничтожении панели", () => {
    const { viewport, wrapper } = setup();
    const viewportOff = vi.spyOn(viewport, "removeEventListener");
    const windowOff = vi.spyOn(window, "removeEventListener");

    wrapper.unmount();
    expect(viewportOff).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(viewportOff).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(windowOff).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(windowOff).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
