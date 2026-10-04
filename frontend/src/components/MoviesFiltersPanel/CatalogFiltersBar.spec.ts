import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CatalogFiltersBar from "./CatalogFiltersBar.vue";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock("@/stores", () => ({ useMoviesStore: () => mocks.store }));

describe("Фильтры каталога", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.store = reactive({
      searchQuery: "", filters: {},
      fetchMovies: vi.fn().mockResolvedValue(undefined),
      findMovie: vi.fn().mockResolvedValue(undefined),
      setCurrentPage: vi.fn(), clearSearch: vi.fn(),
      setFilters: vi.fn((filters) => { mocks.store.filters = filters; }),
    });
  });
  afterEach(() => vi.useRealTimers());
  const render = () => mount(CatalogFiltersBar, { global: { stubs: {
    BaseIcon: true, FiltersSheet: { template: "<div><slot/></div>" }, FiltersActiveTags: true,
    GenreFilter: true, CountryFilter: true, PeriodChips: true,
  } } });

  it("отменяет отложенный поиск при уходе со страницы", async () => {
    const wrapper = render();
    await wrapper.get("input").setValue("Светлячок");
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(350);
    expect(mocks.store.findMovie).not.toHaveBeenCalled();
  });

  it("синхронизирует поле и выбранные жанры со сбросом в сторе", async () => {
    mocks.store.searchQuery = "Светлячок";
    mocks.store.filters = { genres: ["DRAMA"] };
    const wrapper = render();
    expect(wrapper.get("input").element.value).toBe("Светлячок");
    expect(wrapper.findComponent({ name: "GenreFilter" }).attributes("modelvalue")).toBe("DRAMA");
    mocks.store.searchQuery = "";
    mocks.store.filters = {};
    await flushPromises();
    expect(wrapper.get("input").element.value).toBe("");
    expect(mocks.store.fetchMovies).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
