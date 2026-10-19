import { defineComponent, nextTick } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CollectionQuickAdd from "./CollectionQuickAdd.vue";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  add: vi.fn(),
  conflict: new Error("conflict"),
}));

vi.mock("@/composable", () => ({
  useFetch: mocks.fetch,
  FETCH_METHOD: { get: "GET" },
}));

vi.mock("@/stores", () => ({
  useUserMoviesStore: () => ({ addUserMovie: mocks.add }),
}));

vi.mock("@/services/api", () => ({
  getApiResponseMessage: () => undefined,
  isApiConflictError: (error: unknown) => error === mocks.conflict,
}));

vi.mock("ant-design-vue", async (original) => ({
  ...(await original<typeof import("ant-design-vue")>()),
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const autocomplete = defineComponent({
  props: ["options"],
  emits: ["search", "select"],
  template: `<div><input aria-label="Поиск тайтла" @input="$emit('search', $event.target.value)"/><button v-for="option in options" :key="option.value" data-test="quick-option" :disabled="option.disabled" @click="$emit('select', option.value)">{{ option.label }}</button></div>`,
});
const suggestion = {
  id: "movie-1",
  title: "Новый",
  isSerial: false,
  contentKind: "GENERAL",
  publishDate: null,
  inCollection: false,
};

describe("Быстрый ввод коллекции", () => {
  let wrapper: ReturnType<typeof mount>;
  const render = () => {
    wrapper = mount(CollectionQuickAdd, {
      attachTo: document.body,
      props: { userId: "owner", enabled: true, watchTonightEnabled: true },
      global: {
        stubs: {
          BaseIcon: true,
          "a-auto-complete": autocomplete,
          "a-input": true,
        },
      },
    });

    return wrapper;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.fetch
      .mockReset()
      .mockResolvedValue({ status: 200, data: [suggestion] });

    mocks.add.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    wrapper?.unmount();
    document.body.innerHTML = "";
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("закрывает панель по Escape, клику вне и при открытии подбора", async () => {
    render();
    await wrapper.get('[aria-label="Быстрый ввод"]').trigger("click");
    expect(wrapper.find('[aria-label="Поиск тайтла"]').exists()).toBe(true);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(wrapper.find('[aria-label="Поиск тайтла"]').exists()).toBe(false);
    await wrapper.get('[aria-label="Быстрый ввод"]').trigger("click");
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await nextTick();
    expect(wrapper.find('[aria-label="Поиск тайтла"]').exists()).toBe(false);
    await wrapper.get('[aria-label="Быстрый ввод"]').trigger("click");
    await wrapper
      .get('[aria-label="Что посмотреть сегодня?"]')
      .trigger("click");

    expect(wrapper.find('[aria-label="Поиск тайтла"]').exists()).toBe(false);
    expect(wrapper.emitted("watchTonight")).toHaveLength(1);
  });

  it("не возвращает старые подсказки после закрытия и повторного открытия", async () => {
    let finish!: (value: unknown) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    render();
    await wrapper.get('[aria-label="Быстрый ввод"]').trigger("click");
    await wrapper.get("input").setValue("Новый");
    await vi.advanceTimersByTimeAsync(280);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await wrapper.get('[aria-label="Быстрый ввод"]').trigger("click");
    await wrapper.get('[aria-label="Быстрый ввод"]').trigger("click");
    finish({ status: 200, data: [suggestion] });
    await flushPromises();
    expect(wrapper.find('[data-test="quick-option"]').exists()).toBe(false);
  });

  it("отменяет отложенный поиск при отключении и размонтировании", async () => {
    render();
    await wrapper.get('[aria-label="Быстрый ввод"]').trigger("click");
    await wrapper.get("input").setValue("Новый");
    await wrapper.setProps({ enabled: false });
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(wrapper.find('[aria-label="Быстрый ввод"]').exists()).toBe(false);
    await wrapper.setProps({ enabled: true });
    await wrapper.get('[aria-label="Быстрый ввод"]').trigger("click");
    await wrapper.get("input").setValue("Другой");
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("сохраняет панель при конфликте, после успешного добавления закрывает её", async () => {
    mocks.add
      .mockRejectedValueOnce(mocks.conflict)
      .mockResolvedValueOnce(undefined);

    render();
    await wrapper.get('[aria-label="Быстрый ввод"]').trigger("click");
    await wrapper.get("input").setValue("Новый");
    await vi.advanceTimersByTimeAsync(280);
    await wrapper.get('[data-test="quick-option"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("input").exists()).toBe(true);
    await wrapper.get('[data-test="quick-option"]').trigger("click");
    await flushPromises();
    expect(mocks.add).toHaveBeenLastCalledWith("owner", "movie-1", {});
    expect(wrapper.find("input").exists()).toBe(false);
  });
});
