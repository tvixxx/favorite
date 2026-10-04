import { mount, flushPromises } from "@vue/test-utils";
import { ref, computed, reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MovieDetail from "./MovieDetail.vue";

const mocks = vi.hoisted(() => ({ route: { params: { id: "catalog-id" }, query: {} }, fetch: vi.fn() }));
vi.mock("vue-router", () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/state/state", () => ({ useMainStore: () => ({ isLoggedIn: true, userData: { id: "user-id" } }) }));
vi.mock("@/stores", async (original) => ({ ...(await original<Record<string, unknown>>()),
  useUserMoviesStore: () => ({ userMovies: [], fetchUserMovieById: mocks.fetch }),
  useUserListsStore: () => ({ lists: [], isLoading: false }),
}));
vi.mock("@/composable/useReviews", () => ({ useReviews: () => ({ totalReviews: ref(0) }) }));
vi.mock("@/composable", () => ({ useFetch: async () => ({ status: 200, data: [] }), useEscapeKey: vi.fn(), FETCH_METHOD: { get: "GET" } }));
vi.mock("@/services/api", () => ({ getApiResponseMessage: vi.fn(), isApiConflictError: () => false }));
vi.mock("@/components/Skeleton/useMinLoading", () => ({ useMinLoading: (get: () => boolean) => computed(get) }));

describe("Открытие общего тайтла по прямой ссылке", () => {
  beforeEach(() => {
    mocks.route = reactive({ params: { id: "catalog-id" }, query: {} });
    mocks.fetch.mockReset();
    mocks.fetch.mockResolvedValue(null);
  });
  it("показывает предпросмотр, если фильм ещё не добавлен в свою коллекцию", async () => {
    const wrapper = mount(MovieDetail, { global: { stubs: {
      CatalogMoviePreviewModal: { props: ["modelValue", "movieId"], template: '<div v-if="modelValue" data-test="catalog-preview">{{ movieId }}</div>' },
      BaseModal: { props: ["modelValue"], template: '<div v-if="modelValue"><slot name="body"/></div>' },
      StateBlock: true, DetailSkeleton: true, ReviewsWidget: true, RateMovieModal: true, BaseIcon: true,
      "a-button": true, "a-input-number": true, "a-input": true,
    } } });
    await flushPromises();
    expect(wrapper.find('[data-test="catalog-preview"]').text()).toBe("catalog-id");
    wrapper.unmount();
  });

  it("не открывает предыдущий тайтл поздним ответом после смены маршрута", async () => {
    let finishFirst!: (value: null) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }));
    const wrapper = mount(MovieDetail, { global: { stubs: {
      CatalogMoviePreviewModal: { props: ["modelValue", "movieId"], template: '<div v-if="modelValue" data-test="catalog-preview">{{ movieId }}</div>' },
      BaseModal: true, StateBlock: true, DetailSkeleton: true, ReviewsWidget: true,
      RateMovieModal: true, BaseIcon: true, "a-button": true, "a-input-number": true, "a-input": true,
    } } });
    mocks.route.params.id = "second-id";
    await flushPromises();
    finishFirst(null);
    await flushPromises();
    expect(wrapper.get('[data-test="catalog-preview"]').text()).toBe("second-id");
    wrapper.unmount();
  });
});
