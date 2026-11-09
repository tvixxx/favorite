import { shallowMount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import MyListsPage from "./MyListsPage.vue";

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({}),
}));

vi.mock("@/state/state", () => ({ useMainStore: () => ({ userData: null }) }));

vi.mock("@/stores", () => ({
  useUserListsStore: () => ({
    sortedLists: [
      {
        id: "legacy",
        name: "Старый список",
        labels: [],
        _count: { items: 0 },
        color: "url(https://example.test/pixel)",
      },
      {
        id: "valid",
        name: "Цветной список",
        labels: [],
        _count: { items: 0 },
        color: "#007CFF",
      },
    ],
  }),
}));

it("применяет HEX-цвет обложки и игнорирует CSS-фон из старой записи", () => {
  const page = shallowMount(MyListsPage, {
    global: { stubs: { "a-button": true, "a-input": true, "a-textarea": true } },
  });
  const [legacy, valid] = page.findAll<HTMLElement>(".list-card__band");

  expect(legacy.element.style.backgroundImage).toBe("");
  expect(valid.element.style.backgroundColor).toBe("rgb(0, 124, 255)");
  page.unmount();
});
