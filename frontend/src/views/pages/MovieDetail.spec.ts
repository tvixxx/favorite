import { mount, flushPromises } from "@vue/test-utils";
import { ref, computed } from "vue";
import { describe, expect, it, vi } from "vitest";
import MovieDetail from "./MovieDetail.vue";

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { id: "catalog-id" }, query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/state/state", () => ({ useMainStore: () => ({ isLoggedIn: true, userData: { id: "user-id" } }) }));
vi.mock("@/stores", async (original) => ({ ...(await original<Record<string, unknown>>()),
  useUserMoviesStore: () => ({ userMovies: [], fetchUserMovieById: async () => null }),
  useUserListsStore: () => ({ lists: [], isLoading: false }),
}));
vi.mock("@/composable/useReviews", () => ({ useReviews: () => ({ totalReviews: ref(0) }) }));
vi.mock("@/composable", () => ({ useFetch: async () => ({ status: 200, data: [] }), useEscapeKey: vi.fn(), FETCH_METHOD: { get: "GET" } }));
vi.mock("@/services/api", () => ({ getApiResponseMessage: vi.fn(), isApiConflictError: () => false }));
vi.mock("@/components/Skeleton/useMinLoading", () => ({ useMinLoading: (get: () => boolean) => computed(get) }));

describe("Открытие общего тайтла по прямой ссылке", () => {
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
});
