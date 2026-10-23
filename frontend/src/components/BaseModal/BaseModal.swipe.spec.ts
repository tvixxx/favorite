import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import BaseModal from "./BaseModal.vue";
import FiltersSheet from "../MoviesFiltersPanel/FiltersSheet.vue";

const device = vi.hoisted(() => ({ mobile: true }));

vi.mock("@vueuse/core", () => ({ useMediaQuery: () => ref(device.mobile) }));

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
  device.mobile = true;
});

async function createSheet(kind: "modal" | "filters" = "modal") {
  const wrapper = mount(kind === "modal" ? BaseModal : FiltersSheet, {
    props: { modelValue: false, activeCount: 0 },
    slots: {
      title: "Заголовок",
      ...(kind === "modal"
        ? {
            body: '<p class="text">Текст</p><input /><div class="nested" style="overflow-y:auto"><span>Вложенный текст</span></div>',
          }
        : { default: '<p class="text">Текст</p><input />' }),
    },
    global: { stubs: { BaseIcon: true, "a-button": true, Teleport: false } },
  });

  mounted.push(wrapper);
  await wrapper.setProps({ modelValue: true });

  const root = document.querySelector<HTMLElement>(
    kind === "modal" ? ".modal" : ".fsheet"
  )!;
  const header = root.querySelector<HTMLElement>(
    kind === "modal" ? ".modal__header" : ".fsheet__head"
  )!;
  const body = root.querySelector<HTMLElement>(
    kind === "modal" ? ".modal__body" : ".fsheet__body"
  )!;

  return { wrapper, root, header, body };
}

function touch(
  target: Element,
  type: string,
  x: number,
  y: number,
  time = 1000,
  count = 1
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const point = { identifier: 1, clientX: x, clientY: y };

  Object.defineProperties(event, {
    touches: {
      value:
        type === "touchend" || type === "touchcancel"
          ? []
          : Array.from({ length: count }, (_, i) => ({
              ...point,
              identifier: i + 1,
            })),
    },
    changedTouches: { value: [point] },
    timeStamp: { value: time },
  });

  target.dispatchEvent(event);

  return event;
}

describe.each(["modal", "filters"] as const)(
  "Свайп нижнего листа: %s",
  (kind) => {
    it("двигает лист за пальцем из содержимого на верхней границе и закрывает после отпускания", async () => {
      const { wrapper, root, body } = await createSheet(kind);

      touch(body.querySelector(".text")!, "touchstart", 30, 100);

      const move = touch(
        body.querySelector(".text")!,
        "touchmove",
        32,
        210,
        1300
      );

      await nextTick();
      expect(move.defaultPrevented).toBe(true);
      expect(root.style.transform).toBe("translateY(110px)");
      touch(body, "touchend", 32, 210, 1500);
      expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("оставляет содержимое прокручиваться и разрешает закрытие за шапку при прокрученном теле", async () => {
      const { wrapper, root, body, header } = await createSheet(kind);

      body.scrollTop = 80;
      touch(body, "touchstart", 30, 100);

      const move = touch(body, "touchmove", 30, 210, 1300);

      touch(body, "touchend", 30, 210, 1500);
      await nextTick();
      expect(move.defaultPrevented).toBe(false);
      expect(root.style.transform).toBe("");
      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
      touch(header, "touchstart", 30, 100);
      touch(header, "touchmove", 30, 210, 2300);
      touch(header, "touchend", 30, 210, 2500);
      expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("не закрывает лист при горизонтальном жесте и взаимодействии с полем", async () => {
      const { wrapper, root, header, body } = await createSheet(kind);

      for (const target of [header, body.querySelector("input")!]) {
        touch(target, "touchstart", 30, 100);
        touch(target, "touchmove", 240, 210, 1300);
        touch(target, "touchend", 240, 210, 1500);
      }

      await nextTick();
      expect(root.style.transform).toBe("");
      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    });
  }
);

describe("Безопасное завершение свайпа модалки", () => {
  it("возвращает недотянутый жест на место", async () => {
    const { wrapper, root, header } = await createSheet();

    touch(header, "touchstart", 30, 100);
    touch(header, "touchmove", 30, 125, 1300);
    await nextTick();
    expect(root.style.transform).toBe("translateY(25px)");
    touch(header, "touchend", 30, 125, 1600);
    await nextTick();
    expect(root.style.transform).toBe("");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("следует за пальцем обратно до верхней точки без преждевременного возврата", async () => {
    const { wrapper, root, header } = await createSheet();

    touch(header, "touchstart", 30, 100);
    touch(header, "touchmove", 30, 150, 1200);
    await nextTick();
    touch(header, "touchmove", 30, 100, 1400);
    await nextTick();
    expect(root.style.transform).toBe("translateY(0px)");
    expect(root.style.transition).toBe("none");
    touch(header, "touchend", 30, 100, 1600);
    await nextTick();
    expect(root.style.transform).toBe("");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("оставляет вертикальный жест полю ввода и браузеру, если событие уже нельзя перехватить", async () => {
    const { wrapper, root, header, body } = await createSheet();
    const input = body.querySelector("input")!;

    touch(input, "touchstart", 30, 100);
    touch(input, "touchmove", 30, 220, 1300);
    touch(input, "touchend", 30, 220, 1500);
    touch(header, "touchstart", 30, 100);

    const move = new Event("touchmove", { bubbles: true, cancelable: false });

    Object.defineProperty(move, "touches", {
      value: [{ identifier: 1, clientX: 30, clientY: 220 }],
    });

    header.dispatchEvent(move);
    touch(header, "touchend", 30, 220, 1500);
    await nextTick();
    expect(root.style.transform).toBe("");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("не закрывает модалку при отмене системного жеста или втором пальце", async () => {
    const { wrapper, root, header } = await createSheet();

    touch(header, "touchstart", 30, 100);
    touch(header, "touchmove", 30, 220, 1300);
    touch(header, "touchcancel", 30, 220, 1400);
    await nextTick();
    expect(root.style.transform).toBe("");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    touch(header, "touchstart", 30, 100);
    touch(header, "touchmove", 30, 220, 1300, 2);
    touch(header, "touchend", 30, 220, 1500);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("распознаёт короткий быстрый свайп, включая конечную координату отпускания", async () => {
    const { wrapper, header } = await createSheet();

    touch(header, "touchstart", 30, 100);
    touch(header, "touchmove", 30, 120, 1020);
    touch(header, "touchend", 30, 140, 1050);
    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
  });

  it("не перехватывает прокрутку вложенной области", async () => {
    const { wrapper, body } = await createSheet();
    const nested = body.querySelector<HTMLElement>(".nested")!;

    nested.scrollTop = 30;
    touch(nested.querySelector("span")!, "touchstart", 30, 100);

    const move = touch(nested, "touchmove", 30, 220, 1300);

    touch(nested, "touchend", 30, 220, 1500);
    expect(move.defaultPrevented).toBe(false);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("не превращает настольную модалку в перетаскиваемый лист", async () => {
    device.mobile = false;

    const { wrapper, root, header } = await createSheet();

    touch(header, "touchstart", 30, 100);
    touch(header, "touchmove", 30, 220, 1300);
    touch(header, "touchend", 30, 220, 1500);
    await nextTick();
    expect(root.style.transform).toBe("");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });
});
