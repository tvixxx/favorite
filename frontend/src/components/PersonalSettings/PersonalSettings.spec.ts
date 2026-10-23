import { mount, flushPromises } from "@vue/test-utils";
import {
  createPinia,
  disposePinia,
  getActivePinia,
  setActivePinia,
} from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMainStore } from "@/state/state";
import PersonalSettings from "./PersonalSettings.vue";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("@/composable", () => ({
  useFetch: mocks.fetch,
  FETCH_METHOD: { get: "GET", patch: "PATCH", post: "POST" },
}));

vi.mock("@/stores/chat/chatStore", () => ({
  useChatStore: () => ({ disconnect: vi.fn() }),
}));

const profile = {
  id: "owner",
  email: "qa@example.test",
  fullName: "Тест",
  quickAddEnabled: true,
  watchTonightEnabled: false,
  collectionFilesEnabled: false,
  notifyNewMessages: true,
  notifyFriendRequests: true,
  notifyRecommendations: false,
};
let saved: typeof profile;
let wrapper: ReturnType<typeof mount>;

async function open(
  section: "appearance" | "personal" | "notifications" = "appearance"
): Promise<void> {
  setActivePinia(createPinia());
  await useMainStore().fetchUser();
  wrapper = mount(PersonalSettings, { props: { section } });
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

afterEach(() => {
  wrapper?.unmount();
  disposePinia(getActivePinia()!);
  localStorage.clear();
});

describe("Переключатели персональных настроек", () => {
  it("показывает только выбранную категорию без смешивания её переключателей", async () => {
    await open();
    expect(wrapper.find('[aria-label="Показывать достижения"]').exists()).toBe(
      true
    );

    expect(wrapper.find('[aria-label="Быстрый ввод"]').exists()).toBe(false);
    await wrapper.setProps({ section: "personal" });
    expect(wrapper.find('[aria-label="Показывать достижения"]').exists()).toBe(
      false
    );

    expect(wrapper.find('[aria-label="Быстрый ввод"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Новые сообщения"]').exists()).toBe(false);
    await wrapper.setProps({ section: "notifications" });
    expect(wrapper.find('[aria-label="Быстрый ввод"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Новые сообщения"]').exists()).toBe(true);
  });

  it("не показывает ошибку и повтор прежнего сохранения после нового входа в тот же аккаунт", async () => {
    await open();

    const store = useMainStore();
    let rejectSave!: (error: Error) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectSave = reject;
      })
    );

    await wrapper.get('[aria-label="Показывать достижения"]').trigger("click");
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: true });
    await store.logOut();
    mocks.fetch
      .mockResolvedValueOnce({
        status: 200,
        data: { accessToken: "fixture-second-session" },
      })
      .mockResolvedValueOnce({ status: 200, data: { ...profile } });

    await store.logIn({
      email: profile.email,
      password: "fixture-only-password",
    });

    rejectSave(new Error("Ошибка прежней сессии"));
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(
      wrapper
        .get('[aria-label="Показывать достижения"]')
        .attributes("aria-checked")
    ).toBe("true");
  });

  it.each([
    ["showAchievements", "Показывать достижения"],
    ["showCommunityTops", "Топы сообщества"],
    ["showActorsSection", "Раздел «Актёры»"],
  ])(
    "сохраняет %s и обновляет предпросмотр после нового входа",
    async (key, label) => {
      await open();
      expect(
        wrapper.get(`[aria-label="${label}"]`).attributes("aria-checked")
      ).toBe("true");

      await wrapper.get(`[aria-label="${label}"]`).trigger("click");
      await flushPromises();
      expect(wrapper.get(`[data-preview="${key}"]`).text()).toContain("скрыт");
      expect(
        mocks.fetch.mock.calls.find(
          ([, options]) => options?.method === "PATCH"
        )?.[1].data
      ).toEqual({ [key]: false });

      wrapper.unmount();
      disposePinia(getActivePinia()!);
      await open();
      expect(
        wrapper.get(`[aria-label="${label}"]`).attributes("aria-checked")
      ).toBe("false");

      expect(wrapper.get(`[data-preview="${key}"]`).text()).toContain("скрыт");
    }
  );

  it("выбирает основную аналитику, оставляя счётчики в предпросмотре", async () => {
    await open();
    await wrapper.get('input[value="basic"]').setValue(true);
    await flushPromises();
    expect(
      mocks.fetch.mock.calls.find(
        ([, options]) => options?.method === "PATCH"
      )?.[1].data
    ).toEqual({ showDetailedAnalytics: false });

    const preview = wrapper.get('[data-preview="showDetailedAnalytics"]');

    expect(preview.text()).toContain("Основные счётчики");
    expect(preview.find("[data-preview-detail]").exists()).toBe(false);
  });

  it("при ошибке оставляет прежний предпросмотр и позволяет повторить сохранение", async () => {
    await open();
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    await wrapper.get('[aria-label="Показывать достижения"]').trigger("click");
    await flushPromises();
    expect(
      wrapper
        .get('[aria-label="Показывать достижения"]')
        .attributes("aria-checked")
    ).toBe("true");

    expect(
      wrapper
        .get('[data-preview="showAchievements"]')
        .find("[data-preview-detail]")
        .exists()
    ).toBe(true);

    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(
      wrapper
        .get('[aria-label="Показывать достижения"]')
        .attributes("aria-checked")
    ).toBe("false");

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("показывает нужные значения по умолчанию и сохраняет выбор после нового входа", async () => {
    await open("personal");
    expect(
      wrapper.get('[aria-label="Быстрый ввод"]').attributes("aria-checked")
    ).toBe("true");

    expect(
      wrapper
        .get('[aria-label="Что посмотреть сегодня"]')
        .attributes("aria-checked")
    ).toBe("false");

    expect(
      wrapper.get('[aria-label="Импорт и экспорт"]').attributes("aria-checked")
    ).toBe("false");

    await wrapper.get('[aria-label="Что посмотреть сегодня"]').trigger("click");
    await flushPromises();
    expect(
      wrapper
        .get('[aria-label="Что посмотреть сегодня"]')
        .attributes("aria-checked")
    ).toBe("true");

    expect(
      mocks.fetch.mock.calls.find(
        ([, options]) => options?.method === "PATCH"
      )?.[1].data
    ).toEqual({ watchTonightEnabled: true });

    wrapper.unmount();
    disposePinia(getActivePinia()!);
    await open("personal");
    expect(
      wrapper
        .get('[aria-label="Что посмотреть сегодня"]')
        .attributes("aria-checked")
    ).toBe("true");
  });

  it("сохраняет прежнее положение и показывает ошибку при отказе сервера", async () => {
    await open("personal");
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    await wrapper.get('[aria-label="Импорт и экспорт"]').trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Импорт и экспорт"]').attributes("aria-checked")
    ).toBe("false");

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Не удалось сохранить"
    );

    await wrapper.get('[aria-label="Импорт и экспорт"]').trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Импорт и экспорт"]').attributes("aria-checked")
    ).toBe("true");

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
