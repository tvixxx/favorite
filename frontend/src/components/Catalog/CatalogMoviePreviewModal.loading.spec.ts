import { flushPromises, mount } from "@vue/test-utils";
import { reactive, ref } from "vue";
import { Button } from "ant-design-vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CatalogMoviePreviewModal from "./CatalogMoviePreviewModal.vue";
import type { Movie } from "@/stores/movies/types";
import { Genre } from "@/components/Genres/constants/genres.constants";

const movie: Movie = {
  id: "movie-1",
  title: "Йеллоустоун",
  genres: [Genre.DRAMA],
  countryCodes: ["US"],
  publishDate: "2018-06-20T00:00:00Z",
  isSerial: true,
  seasonCount: 5,
  episodeCount: 53,
  actors: [],
  reviews: [],
  description: "Описание сериала",
  averageRating: null,
  imageUrl: "",
  createdAt: "2026-10-18T00:00:00Z",
};
const add = vi.fn();
const screen = vi.hoisted(() => ({ mobile: true }));

vi.mock("@vueuse/core", async (original) => ({
  ...(await original<typeof import("@vueuse/core")>()),
  useMediaQuery: () => ref(screen.mobile),
}));

const state = reactive({
  moviesList: [movie],
  currentMovie: null as Movie | null,
  isMovieLoading: true,
  isMovieError: null as string | null,
  setCurrentMovie: (value: Movie | null) => {
    state.currentMovie = value;
  },
  getMovieDetail: vi.fn(async () => {}),
});

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/state/state", () => ({
  useMainStore: () => ({ userData: { id: "owner" } }),
}));

vi.mock("@/services/api", () => ({
  default: {
    get: vi
      .fn()
      .mockRejectedValue({ isAxiosError: true, response: { status: 404 } }),
  },
}));

vi.mock("@/stores", () => ({
  useMoviesStore: () => state,
  useUserMoviesStore: () => ({ addUserMovie: add }),
}));

const render = () =>
  mount(CatalogMoviePreviewModal, {
    props: { modelValue: true, movieId: movie.id },
    global: {
      components: { AButton: Button },
      stubs: {
        BaseModal: {
          template:
            '<section><slot name="body"/><slot name="footer"/></section>',
        },
        ReportReviewModal: true,
        BaseIcon: true,
        MoviePoster: true,
      },
    },
  });

describe("Загрузка предпросмотра каталога", () => {
  beforeEach(() => {
    state.moviesList = [movie];
    state.currentMovie = null;
    state.isMovieLoading = true;
    state.isMovieError = null;
    add.mockReset();
    screen.mobile = true;
  });

  it("на мобильном показывает шесть актёров, раскрывает остальных и снова сворачивает", async () => {
    state.moviesList = [
      {
        ...movie,
        actors: Array.from({ length: 15 }, (_, i) => ({
          id: String(i),
          name: `Актёр ${i}`,
        })),
      },
    ];

    const wrapper = render();

    expect(wrapper.findAll(".catalog-preview__actor")).toHaveLength(6);
    await wrapper
      .get('[aria-controls="catalog-preview-actors"]')
      .trigger("click");

    expect(wrapper.findAll(".catalog-preview__actor")).toHaveLength(15);
    expect(
      wrapper
        .get('[aria-controls="catalog-preview-actors"]')
        .attributes("aria-expanded")
    ).toBe("true");

    await wrapper
      .get('[aria-controls="catalog-preview-actors"]')
      .trigger("click");

    expect(wrapper.findAll(".catalog-preview__actor")).toHaveLength(6);
    wrapper.unmount();
  });

  it("на десктопе показывает всех актёров сразу", () => {
    screen.mobile = false;
    state.moviesList = [
      {
        ...movie,
        actors: Array.from({ length: 15 }, (_, i) => ({
          id: String(i),
          name: `Актёр ${i}`,
        })),
      },
    ];

    const wrapper = render();

    expect(wrapper.findAll(".catalog-preview__actor")).toHaveLength(15);
    expect(
      wrapper.find('[aria-controls="catalog-preview-actors"]').exists()
    ).toBe(false);

    wrapper.unmount();
  });

  it("не добавляет тайтл во время загрузки, после ответа показывает данные и разрешает добавление", async () => {
    const wrapper = render();
    const button = wrapper.get("button");

    expect((button.element as HTMLButtonElement).disabled).toBe(true);
    expect(wrapper.text()).toContain("Йеллоустоун");
    expect(wrapper.text()).toContain("Описание сериала");
    await button.trigger("click");
    expect(add).not.toHaveBeenCalled();
    state.currentMovie = movie;
    state.isMovieLoading = false;
    await flushPromises();
    expect(wrapper.text()).toContain("Йеллоустоун");
    expect(wrapper.text()).toContain("Описание сериала");
    expect(wrapper.text()).toContain("Сезонов");
    expect(wrapper.text()).toContain("53");
    expect(wrapper.text()).toContain("США");
    expect((wrapper.get("button").element as HTMLButtonElement).disabled).toBe(
      false
    );

    await wrapper.get("button").trigger("click");
    expect(add).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("без данных списка показывает загрузку и заменяет её полученной карточкой", async () => {
    state.moviesList = [];

    const wrapper = render();

    expect(wrapper.find('[aria-label="Загрузка карточки"]').exists()).toBe(
      true
    );

    expect(wrapper.text()).not.toContain("Йеллоустоун");
    state.currentMovie = movie;
    state.isMovieLoading = false;
    await flushPromises();
    expect(wrapper.find('[aria-label="Загрузка карточки"]').exists()).toBe(
      false
    );

    expect(wrapper.text()).toContain("Йеллоустоун");
    wrapper.unmount();
  });

  it("после ошибки оставляет повтор загрузки и не разрешает добавление непроверенной карточки", async () => {
    const wrapper = render();

    state.isMovieLoading = false;
    state.isMovieError = "offline";
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const addButton = buttons.find((button) =>
      button.text().includes("Добавить в мою коллекцию")
    )!;

    expect((addButton.element as HTMLButtonElement).disabled).toBe(true);
    expect(wrapper.text()).toContain("Повторить");
    await addButton.trigger("click");
    expect(add).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
