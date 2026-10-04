import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { computed } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MovieList from "./MovieList.vue";
import { useUserMoviesStore } from "@/stores/userMovies/userMoviesStore";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("vue-router", () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/state/state", () => ({ useMainStore: () => ({ isLoggedIn: true, userData: { id: "user-id" } }) }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, useEscapeKey: vi.fn(), FETCH_METHOD: { get: "GET", post: "POST", delete: "DELETE" } }));
vi.mock("@/constants", async (importOriginal) => ({ ...await importOriginal<object>(), getDefaultLoaderDelayTime: () => 0 }));
vi.mock("@/components/Skeleton/useMinLoading", () => ({ useMinLoading: (get: () => boolean) => computed(get) }));
vi.mock("@/services/api", () => ({ getApiResponseMessage: vi.fn(), isApiConflictError: () => false }));

const row = (id: string) => ({
  id: `link-${id}`, userId: "user-id", movieId: id, isFavorite: false, seeLater: false,
  personalRate: null, watchStatus: "NOT_STARTED", addedAt: "2026-01-01",
  movie: { id, title: `Тайтл ${id}`, description: "", isSerial: false, countryCodes: [], genres: [], poster: null },
});

describe("Загрузка коллекции после прямого открытия детали", () => {
  let wrapper: ReturnType<typeof mount>;
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    mocks.fetch.mockReset();
    mocks.fetch.mockImplementation(async (url: string) => ({
      status: 200, data: url === "/users/user-id/movies" ? [row("1"), row("2")] : row("1"),
    }));
  });
  afterEach(() => {
    wrapper?.unmount();
    disposePinia(getActivePinia()!);
    vi.useRealTimers();
  });

  it("показывает всю коллекцию, даже если кеш уже содержит одну детальную запись", async () => {
    const store = useUserMoviesStore();
    await store.fetchUserMovieById("user-id", "1");
    wrapper = mount(MovieList, { global: { stubs: {
      MovieCard: { props: ["title"], template: '<div class="test-movie">{{ title }}</div>' },
      BaseIcon: true, PosterGridSkeleton: true, StateBlock: true, CollectionFiltersBar: true,
      "a-auto-complete": true, "a-button": true, "a-input": true,
    } } });
    await flushPromises();
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(wrapper.findAll(".test-movie").map((card) => card.text())).toEqual(["Тайтл 1", "Тайтл 2"]);
  });

  it("после смены фильтров загружает общий список вместо старой выборки", async () => {
    const store = useUserMoviesStore();
    store.setFilters({ watchStatus: "COMPLETED" } as never);
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: [row("1")] });
    await store.fetchUserMovies("user-id");
    store.setFilters({});
    wrapper = mount(MovieList, { global: { stubs: {
      MovieCard: { props: ["title"], template: '<div class="test-movie">{{ title }}</div>' },
      BaseIcon: true, PosterGridSkeleton: true, StateBlock: true, CollectionFiltersBar: true,
      "a-auto-complete": true, "a-button": true, "a-input": true,
    } } });
    await flushPromises();
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(wrapper.findAll(".test-movie")).toHaveLength(2);
  });

  it("предупреждает о списках и удаляет только после подтверждения", async () => {
    wrapper = mount(MovieList, { global: { stubs: {
      MovieCard: { props: ["title"], emits: ["delete"], template: '<div class="test-movie"><span>{{ title }}</span><button data-test="remove" @click="$emit(\'delete\')">Удалить</button></div>' },
      BaseModal: { props: ["modelValue"], template: '<section v-if="modelValue" role="dialog"><slot name="body"/><slot name="footer"/></section>' },
      BaseIcon: true, AppSpinner: { props: ["size", "onDark"], template: '<span role="status"/>' }, PosterGridSkeleton: true, StateBlock: true, CollectionFiltersBar: true,
      "a-auto-complete": true, "a-button": true, "a-input": true,
    } } });
    await flushPromises();
    await vi.runAllTimersAsync();
    await wrapper.findAll('[data-test="remove"]')[0].trigger("click");
    const deletions = () => mocks.fetch.mock.calls.filter(([, options]) => options?.method === "DELETE");
    expect(deletions()).toHaveLength(0);
    expect(wrapper.get('[role="dialog"]').text()).toContain("из всех ваших списков");
    await wrapper.get(".confirm-dialog__btn--ghost").trigger("click");
    expect(deletions()).toHaveLength(0);
    await wrapper.findAll('[data-test="remove"]')[0].trigger("click");
    await wrapper.get(".confirm-dialog__btn--danger").trigger("click");
    await flushPromises();
    expect(deletions()).toHaveLength(1);
    expect(wrapper.findAll(".test-movie span").map((card) => card.text())).toEqual(["Тайтл 2"]);
  });
});
