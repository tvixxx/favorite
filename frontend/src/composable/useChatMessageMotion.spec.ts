import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChatMessageMotion } from "./useChatMessageMotion";

type Item = { id: string; senderId: string; isRead?: boolean };

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(reduced = false) {
  const items = ref<Item[]>([]);
  const peer = ref<string | null>("peer");
  const loading = ref(true);
  const cancelled = vi.fn();
  const animate = vi.fn(() => ({
    finished: new Promise<void>(() => undefined),
    cancel: cancelled,
  }));

  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1)
  );

  vi.stubGlobal("cancelAnimationFrame", vi.fn());

  const original = Element.prototype.animate;

  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
  });

  const Host = defineComponent({
    setup() {
      const container = ref<HTMLElement | null>(null);
      const motion = useChatMessageMotion(
        container,
        () => items.value,
        () => peer.value,
        () => loading.value,
        ref("me")
      );

      return () =>
        h("section", [
          h(
            "div",
            { ref: container, onScroll: motion.onScroll },
            items.value.map((item) =>
              h("article", { "data-chat-message": item.id }, item.id)
            )
          ),
          motion.pendingCount.value
            ? h(
                "button",
                { onClick: motion.showLatest },
                "Новые сообщения: " + motion.pendingCount.value
              )
            : null,
        ]);
    },
  });
  const wrapper = mount(Host);

  mounted.push(wrapper);

  const container = wrapper.get("div").element as HTMLElement;

  Object.defineProperties(container, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: {
      configurable: true,
      get: () => container.children.length * 60,
    },
  });

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ height: 60 } as DOMRect)
  );

  return {
    wrapper,
    container,
    items,
    peer,
    loading,
    animate,
    cancelled,
    async history() {
      items.value = [
        { id: "a", senderId: "peer" },
        { id: "b", senderId: "me" },
        { id: "c", senderId: "peer" },
      ];

      loading.value = false;
      await flushPromises();
      container.scrollTop = 80;
    },
    restore() {
      if (original)
        Object.defineProperty(Element.prototype, "animate", {
          configurable: true,
          value: original,
        });
      else Reflect.deleteProperty(Element.prototype, "animate");
    },
  };
}

describe("Новые сообщения в диалоге", () => {
  it("показывает загруженную историю без анимации и не повторяет её при изменении прочтения", async () => {
    const test = setup();

    try {
      await test.history();
      expect(test.animate).not.toHaveBeenCalled();
      test.items.value = test.items.value.map((item) => ({
        ...item,
        isRead: true,
      }));

      await flushPromises();
      expect(test.animate).not.toHaveBeenCalled();
    } finally {
      test.restore();
    }
  });

  it("раскрывает место для нового сообщения за двести двадцать миллисекунд, сохраняя диалог у нижней границы", async () => {
    const test = setup();

    try {
      await test.history();
      test.items.value.push({ id: "new", senderId: "peer" });
      await flushPromises();
      expect(test.animate).toHaveBeenCalledTimes(1);
      expect(test.animate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ height: "0px", opacity: 0 }),
          expect.objectContaining({ height: "60px", opacity: 1 }),
        ]),
        expect.objectContaining({ duration: 220 })
      );

      expect(test.container.scrollTop).toBe(240);
      expect(test.wrapper.find("button").exists()).toBe(false);
    } finally {
      test.restore();
    }
  });

  it("не уводит читающего историю вниз и показывает переход к новым сообщениям", async () => {
    const test = setup();

    try {
      await test.history();
      test.container.scrollTop = 0;
      test.items.value.push({ id: "new", senderId: "peer" });
      await flushPromises();
      expect(test.container.scrollTop).toBe(0);
      expect(test.wrapper.get("button").text()).toBe("Новые сообщения: 1");
      await test.wrapper.get("button").trigger("click");
      expect(test.container.scrollTop).toBe(240);
      expect(test.wrapper.find("button").exists()).toBe(false);
    } finally {
      test.restore();
    }
  });

  it("не обрывает раскрытие предыдущего сообщения при следующем входящем", async () => {
    const test = setup();

    try {
      await test.history();
      test.items.value.push({ id: "first", senderId: "peer" });
      await flushPromises();
      test.items.value.push({ id: "second", senderId: "peer" });
      await flushPromises();
      expect(test.animate).toHaveBeenCalledTimes(2);
      expect(test.cancelled).not.toHaveBeenCalled();
      expect(test.container.scrollTop).toBe(300);
    } finally {
      test.restore();
    }
  });

  it("после собственного сообщения переводит к концу диалога", async () => {
    const test = setup();

    try {
      await test.history();
      test.container.scrollTop = 0;
      test.items.value.push({ id: "sent", senderId: "me" });
      await flushPromises();
      expect(test.container.scrollTop).toBe(240);
    } finally {
      test.restore();
    }
  });

  it("не анимирует повторную загрузку и сохраняет место чтения старых сообщений", async () => {
    const test = setup();

    try {
      await test.history();
      test.container.scrollTop = 0;
      test.loading.value = true;
      await flushPromises();
      test.items.value = [
        ...test.items.value,
        { id: "loaded", senderId: "peer" },
      ];

      test.loading.value = false;
      await flushPromises();
      expect(test.animate).not.toHaveBeenCalled();
      expect(test.container.scrollTop).toBe(0);
    } finally {
      test.restore();
    }
  });

  it("при уменьшении движения сразу показывает сообщение без анимации", async () => {
    const test = setup(true);

    try {
      await test.history();
      test.items.value.push({ id: "new", senderId: "peer" });
      await flushPromises();
      expect(test.animate).not.toHaveBeenCalled();
      expect(test.container.scrollTop).toBe(240);
    } finally {
      test.restore();
    }
  });

  it("отменяет движение и очищает счётчик при смене собеседника", async () => {
    const test = setup();

    try {
      await test.history();
      test.items.value.push({ id: "new", senderId: "peer" });
      await flushPromises();
      test.peer.value = "other";
      test.loading.value = true;
      test.items.value = [];
      await flushPromises();
      expect(test.cancelled).toHaveBeenCalled();
      test.items.value = [{ id: "other-message", senderId: "other" }];
      test.loading.value = false;
      await flushPromises();
      expect(test.animate).toHaveBeenCalledTimes(1);
      expect(test.wrapper.find("button").exists()).toBe(false);
    } finally {
      test.restore();
    }
  });
});
