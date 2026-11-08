import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotificationEvents from "./NotificationEvents.vue";
import type { NotificationEvent } from "./center.types";

function createEvents(reducedMotion = false) {
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }));

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reducedMotion }))
  );

  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "animate"
  );

  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
  });

  const wrapper = mount(NotificationEvents, {
    props: {
      items: [],
      view: "list",
      loading: true,
      ready: false,
      error: "",
      disabled: true,
    },
    global: {
      stubs: {
        BaseIcon: true,
        NotificationEventCard: {
          props: ["item"],
          template: "<article>{{ item.title }}</article>",
        },
      },
    },
  });

  return {
    wrapper,
    animate,
    cancel,
    dispose() {
      wrapper.unmount();
      if (descriptor)
        Object.defineProperty(Element.prototype, "animate", descriptor);
      else Reflect.deleteProperty(Element.prototype, "animate");
    },
  };
}

const event = (id: string): NotificationEvent => ({
  id,
  source: "system",
  type: "SYSTEM",
  actorId: null,
  title: id,
  body: "Текст",
  readAt: null,
  createdAt: "2026-10-22T12:00:00Z",
  actions: [],
});

afterEach(() => vi.unstubAllGlobals());

describe("Появление событий уведомлений", () => {
  it("не показывает пустое состояние до ответа и сохраняет его при повторной загрузке", async () => {
    const { wrapper, dispose } = createEvents();

    try {
      expect(wrapper.text()).not.toContain("Событий пока нет");
      await wrapper.setProps({ ready: true, loading: false });
      expect(wrapper.text()).toContain("Событий пока нет");

      const empty = wrapper.get(".stateblock").element;

      await wrapper.setProps({ loading: true });
      expect(wrapper.findAll(".skel")).toHaveLength(0);
      expect(wrapper.get(".stateblock").element).toBe(empty);
      await wrapper.setProps({ loading: false });
      expect(wrapper.get(".stateblock").element).toBe(empty);
    } finally {
      dispose();
    }
  });

  it("плавно показывает новую выборку после ответа, но не анимирует первое открытие и те же события", async () => {
    const { wrapper, animate, dispose } = createEvents();

    try {
      await wrapper.setProps({
        ready: true,
        loading: false,
        items: [event("первое")],
      });

      expect(animate).not.toHaveBeenCalled();
      await wrapper.setProps({ loading: true, disabled: true });
      expect(wrapper.text()).toContain("первое");
      expect(animate).not.toHaveBeenCalled();
      await wrapper.setProps({
        loading: false,
        items: [{ ...event("первое"), readAt: "2026-10-22T13:00:00Z" }],
      });

      expect(animate).not.toHaveBeenCalled();
      await wrapper.setProps({ loading: true });
      await wrapper.setProps({ loading: false, items: [event("второе")] });
      await flushPromises();
      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate).toHaveBeenCalledWith(
        [{ opacity: 0 }, { opacity: 1 }],
        expect.objectContaining({ duration: 180 })
      );

      expect(wrapper.text()).toContain("второе");
      expect(wrapper.text()).not.toContain("первое");
      await wrapper.setProps({ items: [], loading: false });
      await flushPromises();
      expect(wrapper.text()).toContain("Событий пока нет");
      expect(animate).toHaveBeenCalledTimes(2);
    } finally {
      dispose();
    }
  });

  it("не запускает движение при пользовательской настройке уменьшенной анимации", async () => {
    const { wrapper, animate, dispose } = createEvents(true);

    try {
      await wrapper.setProps({ loading: false, ready: true });
      await wrapper.setProps({ items: [event("новое")] });
      await wrapper.setProps({ view: "grid" });
      await flushPromises();
      expect(wrapper.text()).toContain("новое");
      expect(wrapper.find(".notification-events--grid").exists()).toBe(true);
      expect(wrapper.find("[inert]").exists()).toBe(false);
      expect(animate).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it("при смене вида оставляет карточки на месте в DOM и убирает снимок прежней раскладки", async () => {
    const { wrapper, animate, cancel, dispose } = createEvents();

    try {
      await wrapper.setProps({
        loading: false,
        ready: true,
        items: [event("событие")],
      });

      const card = wrapper.get("article").element;

      await wrapper.setProps({ view: "grid" });
      await flushPromises();
      expect(wrapper.get(".notification-events--grid article").element).toBe(
        card
      );

      expect(wrapper.get("[inert]").attributes("aria-hidden")).toBe("true");
      expect(animate).toHaveBeenCalledWith(
        [{ opacity: 1 }, { opacity: 0 }],
        expect.objectContaining({ duration: 180 })
      );

      await wrapper.setProps({ view: "compact" });
      await flushPromises();
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(wrapper.findAll("[inert]")).toHaveLength(1);
      expect(wrapper.get(".notification-events--compact article").element).toBe(
        card
      );
    } finally {
      dispose();
    }
  });

  it("при фильтрации сохраняет совпавшую карточку и затухает только исключённая", async () => {
    const { wrapper, animate, dispose } = createEvents();

    try {
      const keep = event("остаётся");

      await wrapper.setProps({
        loading: false,
        ready: true,
        items: [event("уходит"), keep],
      });

      const card = wrapper.findAll("article")[1].element;

      vi.spyOn(card, "getBoundingClientRect")
        .mockReturnValueOnce(new DOMRect(0, 80, 320, 80))
        .mockReturnValue(new DOMRect(0, 0, 320, 80));

      await wrapper.setProps({ loading: true });
      expect(animate).not.toHaveBeenCalled();
      expect(wrapper.findAll("article")).toHaveLength(2);
      await wrapper.setProps({
        loading: false,
        filterKey: "friends",
        items: [keep],
      });

      await flushPromises();
      expect(
        wrapper.get(".notification-events:not([inert]) article").element
      ).toBe(card);

      expect(wrapper.get("[inert]").text()).toBe("уходит");
      expect(animate).toHaveBeenCalledWith(
        [{ transform: "translate(0px, 80px)" }, { transform: "none" }],
        expect.objectContaining({ duration: 220 })
      );

      expect(animate).toHaveBeenCalledWith(
        [{ opacity: 1 }, { opacity: 0 }],
        expect.objectContaining({ duration: 150 })
      );
    } finally {
      dispose();
    }
  });

  it("отменяет предыдущую анимацию при новой выборке и при закрытии страницы", async () => {
    const { wrapper, animate, cancel, dispose } = createEvents();

    await wrapper.setProps({ loading: false, ready: true });
    await wrapper.setProps({ items: [event("первое")] });
    await flushPromises();
    await wrapper.setProps({ items: [event("второе")] });
    await flushPromises();
    expect(animate).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    dispose();
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});
