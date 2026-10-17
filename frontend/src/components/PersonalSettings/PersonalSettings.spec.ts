import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMainStore } from "@/state/state";
import PersonalSettings from "./PersonalSettings.vue";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET", patch: "PATCH", post: "POST" } }));
const profile = { id: "owner", email: "qa@example.test", fullName: "Тест", quickAddEnabled: true, watchTonightEnabled: false, collectionFilesEnabled: false, notifyNewMessages: true, notifyFriendRequests: true, notifyRecommendations: false };
let saved: typeof profile;
let wrapper: ReturnType<typeof mount>;
async function open(): Promise<void> {
  setActivePinia(createPinia());
  await useMainStore().fetchUser();
  wrapper = mount(PersonalSettings);
}

beforeEach(() => {
  localStorage.clear();
  saved = { ...profile };
  mocks.fetch.mockReset();
  mocks.fetch.mockImplementation(async (_url, options) => {
    if (options?.method === "PATCH") saved = { ...saved, ...options.data };

    return { status: 200, data: { ...saved } };
  });
});
afterEach(() => { wrapper?.unmount(); disposePinia(getActivePinia()!); localStorage.clear(); });

describe("Переключатели персональных настроек", () => {
  it("показывает нужные значения по умолчанию и сохраняет выбор после нового входа", async () => {
    await open();
    expect(wrapper.get('[aria-label="Быстрый ввод"]').attributes("aria-checked")).toBe("true");
    expect(wrapper.get('[aria-label="Что посмотреть сегодня"]').attributes("aria-checked")).toBe("false");
    expect(wrapper.get('[aria-label="Импорт и экспорт"]').attributes("aria-checked")).toBe("false");
    await wrapper.get('[aria-label="Что посмотреть сегодня"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="Что посмотреть сегодня"]').attributes("aria-checked")).toBe("true");
    expect(mocks.fetch.mock.calls.find(([, options]) => options?.method === "PATCH")?.[1].data).toEqual({ watchTonightEnabled: true });
    wrapper.unmount();
    disposePinia(getActivePinia()!);
    await open();
    expect(wrapper.get('[aria-label="Что посмотреть сегодня"]').attributes("aria-checked")).toBe("true");
  });

  it("сохраняет прежнее положение и показывает ошибку при отказе сервера", async () => {
    await open();
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    await wrapper.get('[aria-label="Импорт и экспорт"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="Импорт и экспорт"]').attributes("aria-checked")).toBe("false");
    expect(wrapper.get('[role="alert"]').text()).toContain("Не удалось сохранить");
    await wrapper.get('[aria-label="Импорт и экспорт"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="Импорт и экспорт"]').attributes("aria-checked")).toBe("true");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
