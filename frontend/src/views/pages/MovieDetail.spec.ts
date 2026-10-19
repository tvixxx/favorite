import { mount, flushPromises } from "@vue/test-utils";
import { ref, computed, reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MovieDetail from "./MovieDetail.vue";

const mocks = vi.hoisted(() => ({
  route: { params: { id: "catalog-id" }, query: {} },
  fetch: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/state/state", () => ({
  useMainStore: () => ({ isLoggedIn: true, userData: { id: "user-id" } }),
}));

vi.mock("@/stores", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useUserMoviesStore: () => ({
    userMovies: [],
    fetchUserMovieById: mocks.fetch,
  }),
  useUserListsStore: () => ({ lists: [], isLoading: false }),
}));

vi.mock("@/composable/useReviews", () => ({
  useReviews: () => ({ totalReviews: ref(0) }),
}));

vi.mock("@/composable", () => ({
  useFetch: async () => ({ status: 200, data: [] }),
  useEscapeKey: vi.fn(),
  FETCH_METHOD: { get: "GET" },
}));

vi.mock("@/services/api", () => ({
  getApiResponseMessage: vi.fn(),
  isApiConflictError: () => false,
}));

vi.mock("@/components/Skeleton/useMinLoading", () => ({
  useMinLoading: (get: () => boolean) => computed(get),
}));

describe("Открытие общего тайтла по прямой ссылке", () => {
  beforeEach(() => {
    mocks.route = reactive({ params: { id: "catalog-id" }, query: {} });
    mocks.fetch.mockReset();
    mocks.fetch.mockResolvedValue(null);
  });

  it("показывает предпросмотр, если фильм ещё не добавлен в свою коллекцию", async () => {
    const wrapper = mount(MovieDetail, {
      global: {
        stubs: {
          CatalogMoviePreviewModal: {
            props: ["modelValue", "movieId"],
            template:
              '<div v-if="modelValue" data-test="catalog-preview">{{ movieId }}</div>',
          },
          BaseModal: {
            props: ["modelValue"],
            template: '<div v-if="modelValue"><slot name="body"/></div>',
          },
          StateBlock: true,
          DetailSkeleton: true,
          ReviewsWidget: true,
          RateMovieModal: true,
          BaseIcon: true,
          "a-button": true,
          "a-input-number": true,
          "a-input": true,
        },
      },
    });

    await flushPromises();
    expect(wrapper.find('[data-test="catalog-preview"]').text()).toBe(
      "catalog-id"
    );

    wrapper.unmount();
  });

  it("не открывает предыдущий тайтл поздним ответом после смены маршрута", async () => {
    let finishFirst!: (value: null) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finishFirst = resolve;
      })
    );

    const wrapper = mount(MovieDetail, {
      global: {
        stubs: {
          CatalogMoviePreviewModal: {
            props: ["modelValue", "movieId"],
            template:
              '<div v-if="modelValue" data-test="catalog-preview">{{ movieId }}</div>',
          },
          BaseModal: true,
          StateBlock: true,
          DetailSkeleton: true,
          ReviewsWidget: true,
          RateMovieModal: true,
          BaseIcon: true,
          "a-button": true,
          "a-input-number": true,
          "a-input": true,
        },
      },
    });

    mocks.route.params.id = "second-id";
    await flushPromises();
    finishFirst(null);
    await flushPromises();
    expect(wrapper.get('[data-test="catalog-preview"]').text()).toBe(
      "second-id"
    );

    wrapper.unmount();
  });

  it("после закрытия предпросмотра открывает добавленный тайтл, даже если его нет в загруженной странице", async () => {
    mocks.fetch.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "link",
      movieId: "catalog-id",
      userId: "user-id",
      watchStatus: "NOT_STARTED",
      movie: {
        id: "catalog-id",
        title: "Добавленный тайтл",
        genres: [],
        countryCodes: [],
        actors: [],
        isSerial: false,
      },
    });

    const wrapper = mount(MovieDetail, {
      global: {
        stubs: {
          CatalogMoviePreviewModal: {
            props: ["modelValue", "movieId"],
            emits: ["update:modelValue"],
            template:
              '<button v-if="modelValue" data-test="close-preview" @click="$emit(\'update:modelValue\', false)">Закрыть</button>',
          },
          BaseModal: true,
          StateBlock: true,
          DetailSkeleton: true,
          ReviewsWidget: true,
          RateMovieModal: true,
          BaseIcon: true,
          MovieShareButton: true,
          WatchStatusSelect: true,
          "a-button": true,
          "a-input-number": true,
          "a-input": true,
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="close-preview"]').trigger("click");
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Добавленный тайтл");
    wrapper.unmount();
  });
});

describe("Компактный список актёров в карточке", () => {
  const movieWithActors = (count: number, id = "catalog-id") => ({
    id: "link-" + id,
    movieId: id,
    userId: "user-id",
    watchStatus: "NOT_STARTED",
    movie: {
      id,
      title: "Тестовый тайтл",
      genres: [],
      countryCodes: [],
      isSerial: false,
      actors: Array.from({ length: count }, (_, index) => ({
        id: "actor-" + index,
        name: "Актёр " + (index + 1),
      })),
    },
  });
  const render = () =>
    mount(MovieDetail, {
      global: {
        stubs: {
          CatalogMoviePreviewModal: true,
          BaseModal: true,
          StateBlock: true,
          DetailSkeleton: true,
          ReviewsWidget: true,
          RateMovieModal: true,
          BaseIcon: true,
          MovieShareButton: true,
          WatchStatusSelect: true,
          "a-button": true,
          "a-input": true,
        },
      },
    });

  beforeEach(() => {
    mocks.route = reactive({ params: { id: "catalog-id" }, query: {} });
    mocks.fetch.mockReset();
  });

  it("показывает первых шесть, раскрывает всех по кнопке и снова сворачивает", async () => {
    mocks.fetch.mockResolvedValue(movieWithActors(100));

    const wrapper = render();

    await flushPromises();
    expect(wrapper.findAll(".actor-card")).toHaveLength(6);
    expect(
      wrapper.findAll(".actor-card__name").map((actor) => actor.text())
    ).toEqual(Array.from({ length: 6 }, (_, i) => "Актёр " + (i + 1)));

    const toggle = wrapper.get("button.actors-toggle");

    expect(toggle.text()).toContain("100");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(toggle.attributes("type")).toBe("button");
    await toggle.trigger("click");
    expect(wrapper.findAll(".actor-card")).toHaveLength(100);
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(toggle.text()).toBe("Свернуть");
    await toggle.trigger("click");
    expect(wrapper.findAll(".actor-card")).toHaveLength(6);
    wrapper.unmount();
  });

  it.each([0, 6])(
    "не показывает кнопку для состава из %s актёров",
    async (count) => {
      mocks.fetch.mockResolvedValue(movieWithActors(count));

      const wrapper = render();

      await flushPromises();
      expect(wrapper.findAll(".actor-card")).toHaveLength(count);
      expect(wrapper.find(".actors-toggle").exists()).toBe(false);
      wrapper.unmount();
    }
  );

  it("сворачивает состав при переходе к другому произведению", async () => {
    mocks.fetch
      .mockResolvedValueOnce(movieWithActors(15))
      .mockResolvedValueOnce(movieWithActors(20, "second-id"));

    const wrapper = render();

    await flushPromises();
    await wrapper.get(".actors-toggle").trigger("click");
    expect(wrapper.findAll(".actor-card")).toHaveLength(15);
    mocks.route.params.id = "second-id";
    await flushPromises();
    expect(wrapper.findAll(".actor-card")).toHaveLength(6);
    expect(wrapper.get(".actors-toggle").attributes("aria-expanded")).toBe(
      "false"
    );

    expect(wrapper.get(".actors-toggle").text()).toContain("20");
    wrapper.unmount();
  });
});
