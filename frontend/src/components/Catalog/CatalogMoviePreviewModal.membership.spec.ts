import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CatalogMoviePreviewModal from "./CatalogMoviePreviewModal.vue";

const calls = vi.hoisted(() => ({ get: vi.fn(), add: vi.fn(), push: vi.fn() }));
const session = reactive({ userData: { id: "viewer", role: "USER" } });
const movies = reactive({
  currentMovie: null as Record<string, unknown> | null,
  moviesList: [],
  isMovieLoading: false,
  isMovieError: null,
  setCurrentMovie(value: Record<string, unknown> | null) {
    this.currentMovie = value;
  },
  async getMovieDetail(id: string) {
    this.currentMovie = {
      id,
      title: "Произведение",
      createdById: "viewer",
      genres: [],
      actors: [],
      reviews: [],
    };
  },
});

vi.mock("@/services/api", () => ({
  default: { get: calls.get },
  getApiResponseMessage: vi.fn(),
}));

vi.mock("@/state/state", () => ({ useMainStore: () => session }));
vi.mock("@/stores", () => ({
  useMoviesStore: () => movies,
  useUserMoviesStore: () => ({ userMovies: [], addUserMovie: calls.add }),
}));

vi.mock("vue-router", () => ({ useRouter: () => ({ push: calls.push }) }));

const missing = () => ({ isAxiosError: true, response: { status: 404 } });
const render = () =>
  mount(CatalogMoviePreviewModal, {
    props: { modelValue: true, movieId: "first" },
    global: {
      stubs: {
        BaseModal: {
          template:
            '<section><slot name="body"/><slot name="footer"/></section>',
        },
        CatalogPreviewHero: true,
        ReportReviewModal: true,
        MoviePosterEditor: true,
        BaseIcon: true,
        "a-button": {
          props: ["disabled", "loading"],
          template: '<button :disabled="disabled || loading"><slot/></button>',
        },
      },
    },
  });

beforeEach(() => {
  calls.get.mockReset().mockRejectedValue(missing());
  calls.add.mockReset().mockResolvedValue({ id: "new-link" });
  session.userData.id = "viewer";
  movies.currentMovie = null;
});

describe("Принадлежность произведения коллекции в каталоге", () => {
  it("узнаёт уже добавленное произведение вне загруженной страницы коллекции", async () => {
    calls.get.mockResolvedValue({ data: { id: "existing-link" }, status: 200 });

    const wrapper = render();

    await flushPromises();
    expect(wrapper.text()).toContain("Уже в вашей коллекции");
    expect(wrapper.text()).not.toContain("Добавить в мою коллекцию");
    expect(calls.get).toHaveBeenCalledWith(
      "/users/viewer/movies/first",
      expect.anything()
    );

    expect(calls.add).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("не отправляет добавление до ответа проверки наличия в коллекции", async () => {
    let finish!: (value: unknown) => void;

    calls.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const wrapper = render();

    await flushPromises();
    expect(wrapper.text()).toContain("Проверяем коллекцию");
    expect(
      wrapper.get(".catalog-preview__cta").attributes("disabled")
    ).toBeDefined();

    await wrapper.get(".catalog-preview__cta").trigger("click");
    expect(calls.add).not.toHaveBeenCalled();

    finish({ data: { id: "existing" }, status: 200 });
    await flushPromises();
    expect(wrapper.text()).toContain("Уже в вашей коллекции");
    wrapper.unmount();
  });

  it("позволяет добавить только один раз и запоминает результат при повторном открытии", async () => {
    const wrapper = render();

    await flushPromises();
    expect(wrapper.text()).toContain("Добавить в мою коллекцию");

    let finish!: (value: unknown) => void;

    calls.add.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    await wrapper.get(".catalog-preview__cta").trigger("click");
    await wrapper.get(".catalog-preview__cta").trigger("click");
    expect(calls.add).toHaveBeenCalledTimes(1);
    finish({ id: "new-link" });
    await flushPromises();
    expect(wrapper.text()).toContain("Уже в вашей коллекции");
    await wrapper.setProps({ modelValue: false });
    calls.get.mockResolvedValueOnce({ data: { id: "new-link" }, status: 200 });
    await wrapper.setProps({ modelValue: true });
    await flushPromises();
    expect(wrapper.text()).toContain("Уже в вашей коллекции");
    wrapper.unmount();
  });

  it("после ошибки проверки предлагает повтор, а не добавление вслепую", async () => {
    calls.get.mockRejectedValueOnce(new Error("offline"));

    const wrapper = render();

    await flushPromises();
    expect(wrapper.text()).toContain("Не удалось проверить коллекцию");
    expect(wrapper.text()).not.toContain("Добавить в мою коллекцию");
    calls.get.mockRejectedValueOnce(missing());
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Повторить проверку")!
      .trigger("click");

    await flushPromises();
    expect(wrapper.text()).toContain("Добавить в мою коллекцию");
    wrapper.unmount();
  });

  it("игнорирует поздний ответ предыдущей карточки", async () => {
    let finish!: (value: unknown) => void;

    calls.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const wrapper = render();

    await flushPromises();
    await wrapper.setProps({ movieId: "second" });
    await flushPromises();
    finish({ data: { id: "old-link" }, status: 200 });
    await flushPromises();
    expect(wrapper.text()).toContain("Добавить в мою коллекцию");
    expect(wrapper.text()).not.toContain("Уже в вашей коллекции");
    wrapper.unmount();
  });
});
