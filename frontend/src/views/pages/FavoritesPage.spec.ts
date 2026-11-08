import { flushPromises, shallowMount } from "@vue/test-utils";
import { reactive } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { UserMoviesFilters } from "@/stores";
import CollectionFiltersBar from "@/components/MoviesFiltersPanel/CollectionFiltersBar.vue";
import FavoritesPage from "./FavoritesPage.vue";

const mocks = vi.hoisted(() => ({ store: {} }));

vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/state/state", () => ({
  useMainStore: () => ({ isLoggedIn: true, userData: { id: "user" } }),
}));

vi.mock("@/stores", () => ({ useUserMoviesStore: () => mocks.store }));

describe("Фильтры избранного", () => {
  it("после смены вкладки сохраняет страну, но не прежний формат вкладки", async () => {
    const store = reactive({
      filters: {} as UserMoviesFilters,
      setFilters: vi.fn((value: UserMoviesFilters) => {
        store.filters = value;
      }),
      setCurrentPage: vi.fn(),
      fetchUserMovies: vi.fn().mockResolvedValue(undefined),
      clearSearch: vi.fn(),
      searchQuery: "",
      favoriteUserMovies: [],
      isLoaded: false,
      isLoading: false,
      totalCount: 0,
    });

    mocks.store = store;

    const wrapper = shallowMount(FavoritesPage);

    try {
      await flushPromises();

      const choose = async (label: string) => {
        await wrapper
          .findAll("button")
          .find((button) => button.text() === label)!
          .trigger("click");

        await flushPromises();
      };

      await choose("Сериалы");
      expect(store.setFilters).toHaveBeenLastCalledWith({
        isFavorite: true,
        isSerial: true,
      });

      const bar = wrapper.getComponent(CollectionFiltersBar);

      bar.vm.$emit("update:filters", {
        ...bar.props("filters"),
        countryCodes: ["US"],
      });

      await flushPromises();
      await choose("Все");
      expect(store.setFilters).toHaveBeenLastCalledWith({
        isFavorite: true,
        countryCodes: ["US"],
      });
    } finally {
      wrapper.unmount();
    }
  });
});
