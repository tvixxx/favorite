import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PwaStatus from "./PwaStatus.vue";

const mocks = vi.hoisted(() => ({
  refresh: true,
  apply: vi.fn(),
  update: vi.fn(),
  reload: vi.fn(),
  options: null as unknown as {
    onRegisteredSW: (
      url: string,
      registration: ServiceWorkerRegistration
    ) => void;
    onNeedReload: () => void;
  },
}));
vi.mock("virtual:pwa-register/vue", async () => {
  const { ref } = await import("vue");

  return {
    useRegisterSW: (options: typeof mocks.options) => {
      mocks.options = options;

      return {
        needRefresh: ref(mocks.refresh),
        updateServiceWorker: mocks.apply,
      };
    },
  };
});

function render() {
  return mount(PwaStatus, {
    global: {
      stubs: {
        BaseIcon: true,
        AButton: {
          props: ["disabled", "loading"],
          template: '<button :disabled="disabled || loading"><slot/></button>',
        },
        BaseModal: {
          props: ["modelValue"],
          template:
            '<section v-if="modelValue" role="dialog"><slot name="title"/><slot name="body"/><slot name="footer"/></section>',
        },
      },
    },
  });
}

beforeEach(() => {
  mocks.refresh = true;
  mocks.apply.mockReset().mockResolvedValue(undefined);
  mocks.update.mockReset().mockResolvedValue(undefined);
  mocks.reload.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("Обновление PWA без потери формы", () => {
  it("перезагружает подтверждённую версию при смене контроллера после первой установки", async () => {
    const serviceWorker = new EventTarget();
    vi.stubGlobal("navigator", { serviceWorker, onLine: true });
    const currentWindow = window;
    vi.stubGlobal(
      "window",
      new Proxy(currentWindow, {
        get(target, key) {
          return key === "location"
            ? { reload: mocks.reload }
            : Reflect.get(target, key);
        },
      })
    );
    const wrapper = render();

    serviceWorker.dispatchEvent(new Event("controllerchange"));
    expect(mocks.reload).not.toHaveBeenCalled();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Обновить")!
      .trigger("click");
    await wrapper
      .get('[role="dialog"]')
      .findAll("button")
      .find((button) => button.text() === "Обновить")!
      .trigger("click");
    await flushPromises();
    serviceWorker.dispatchEvent(new Event("controllerchange"));
    mocks.options.onNeedReload?.();
    expect(mocks.reload).toHaveBeenCalledOnce();
    wrapper.unmount();
    vi.unstubAllGlobals();
  });
  it("показывает восстановление после ошибки загрузки страницы", async () => {
    mocks.refresh = false;
    const wrapper = render();

    window.dispatchEvent(new Event("vite:preloadError"));
    await flushPromises();
    expect(wrapper.text()).toContain("Не удалось загрузить страницу");
    expect(
      wrapper.findAll("button").some((button) => button.text() === "Повторить")
    ).toBe(true);
    expect(mocks.apply).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it("предлагает новую версию, но применяет её только после подтверждения", async () => {
    const wrapper = render();

    expect(wrapper.text()).toContain("Доступна новая версия");
    expect(mocks.apply).not.toHaveBeenCalled();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Обновить")!
      .trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "Сохраните изменения"
    );
    expect(mocks.apply).not.toHaveBeenCalled();
    await wrapper
      .get('[role="dialog"]')
      .findAll("button")
      .find((button) => button.text() === "Обновить")!
      .trigger("click");
    await flushPromises();
    expect(mocks.apply).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("откладывает обновление без перезагрузки", async () => {
    const wrapper = render();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Позже")!
      .trigger("click");
    expect(wrapper.text()).not.toContain("Доступна новая версия");
    expect(mocks.apply).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("проверяет новую версию после возврата сети и снимает обработчики при закрытии", async () => {
    const wrapper = render();

    mocks.options.onRegisteredSW("/sw.js", {
      update: mocks.update,
    } as unknown as ServiceWorkerRegistration);
    window.dispatchEvent(new Event("online"));
    await flushPromises();
    expect(mocks.update).toHaveBeenCalledOnce();
    wrapper.unmount();
    window.dispatchEvent(new Event("online"));
    expect(mocks.update).toHaveBeenCalledOnce();
  });
});
