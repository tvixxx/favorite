import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsers from "./AdminUsers.vue";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/services/api", () => ({ default: { get: mocks.get } }));
vi.mock("vue-router", () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/state/state", () => ({
  useMainStore: () => ({ userData: { id: "admin" } }),
}));

const stubs = {
  AdminDateFilters: true,
  BaseModal: true,
  "a-input": true,
  "a-select": true,
  "a-button": { template: "<button><slot/></button>" },
  "a-textarea": true,
  "a-pagination": true,
};
let wrapper: ReturnType<typeof mount>;

beforeEach(() =>
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  }))
);

afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
});

describe("Состояния загрузки пользователей администратора", () => {
  it("показывает один лоадер без пустого состояния, затем отдельное сообщение об отсутствии результатов", async () => {
    let finish!: (value: unknown) => void;

    mocks.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    wrapper = mount(AdminUsers, { global: { stubs } });
    await nextTick();
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    expect(wrapper.get(".ant-table-placeholder").isVisible()).toBe(false);
    finish({ data: { items: [], total: 0 } });
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.get(".ant-table-placeholder").isVisible()).toBe(true);
    expect(wrapper.text()).toContain("Пользователи не найдены");
    expect(wrapper.text()).not.toContain("No data");
    wrapper.unmount();
  });

  it("после ошибки запроса показывает ошибку с повтором вместо сообщения о пустом списке", async () => {
    mocks.get.mockRejectedValueOnce(new Error("QA unavailable"));
    wrapper = mount(AdminUsers, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain("Не удалось загрузить данные");
    expect(wrapper.text()).toContain("Повторить");
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.find(".ant-table-placeholder").exists()).toBe(false);
    wrapper.unmount();
  });
});
