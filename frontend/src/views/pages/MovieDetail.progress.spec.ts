import { flushPromises, mount } from "@vue/test-utils";
import { computed, reactive, ref } from "vue";
import { Button, message } from "ant-design-vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WatchStatus, type UserMovie } from "@/stores";
import MovieDetail from "./MovieDetail.vue";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), update: vi.fn() }));
const route = reactive({ params: { id: "movie-id" }, query: {} });

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/state/state", () => ({
  useMainStore: () => ({
    isLoggedIn: true,
    userData: { id: "owner", timezone: "UTC" },
  }),
}));

vi.mock("@/stores", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useUserMoviesStore: () => ({
    userMovies: [],
    fetchUserMovieById: mocks.fetch,
    updateUserMovie: mocks.update,
  }),
  useUserListsStore: () => ({ sortedLists: [], isLoading: false }),
}));

vi.mock("@/composable/useReviews", () => ({
  useReviews: () => ({ totalReviews: ref(0) }),
}));

vi.mock("@/services/api", () => ({
  getApiResponseMessage: vi.fn(),
  isApiConflictError: () => false,
}));

vi.mock("@/composable", async () => ({
  useFetch: async () => ({ status: 200, data: [] }),
  useEscapeKey: (await import("@/composable/useEscapeKey")).useEscapeKey,
  FETCH_METHOD: { get: "GET" },
}));

vi.mock("@/components/Skeleton/useMinLoading", () => ({
  useMinLoading: (get: () => boolean) => computed(get),
}));

vi.mock("ant-design-vue", async (original) => ({
  ...(await original<typeof import("ant-design-vue")>()),
  message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const createMovie = (overrides: Partial<UserMovie> = {}): UserMovie => ({
  id: "link-id",
  userId: "owner",
  movieId: "movie-id",
  isFavorite: false,
  seeLater: false,
  personalRate: null,
  watchStatus: WatchStatus.WATCHING,
  currentSeason: 1,
  currentEpisode: 3,
  addedAt: "2026-10-01T00:00:00Z",
  lastWatchedAt: null,
  startedAt: "2026-10-02T12:00:00Z",
  completedAt: null,
  droppedAt: null,
  movie: {
    id: "movie-id",
    title: "Сериал",
    description: "Описание",
    genres: [],
    countryCodes: [],
    actors: [],
    isSerial: true,
    seasonCount: 3,
    episodeCount: 12,
    publishDate: null,
    imageUrl: "",
    createdAt: "2026-10-01T00:00:00Z",
  },
  ...overrides,
});

describe("Прогресс просмотра в карточке произведения", () => {
  let wrapper: ReturnType<typeof mount>;
  let saved: UserMovie;
  const render = async (movie = createMovie()): Promise<void> => {
    saved = movie;
    mocks.fetch.mockImplementation(async () => saved);
    mocks.update.mockImplementation(
      async (_user: string, _id: string, payload: Partial<UserMovie>) => {
        saved = { ...saved, ...payload };

        return saved;
      }
    );

    wrapper = mount(MovieDetail, {
      global: {
        components: { AButton: Button },
        stubs: {
          CatalogMoviePreviewModal: true,
          AddMovieToListModal: true,
          DetailSkeleton: true,
          ReviewsWidget: true,
          RateMovieModal: true,
          MoviePosterEditor: true,
          ContentTypeEditor: true,
          WatchDiary: true,
          BaseIcon: true,
          MovieShareButton: true,
          WatchStatusSelect: {
            props: ["modelValue", "disabled"],
            emits: ["update:modelValue"],
            template:
              '<select :value="modelValue" :disabled="disabled" aria-label="Статус просмотра" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="s in [\'NOT_STARTED\',\'WATCHING\',\'COMPLETED\',\'DROPPED\']" :value="s">{{s}}</option></select>',
          },
        },
      },
    });

    await flushPromises();
  };
  const button = (label: string) =>
    wrapper.get(`button[aria-label="${label}"]`);
  const edit = async (): Promise<void> => {
    await button("Изменить прогресс просмотра").trigger("click");
  };
  const save = async (): Promise<void> => {
    await wrapper
      .get(".serial-progress__edit-actions .ant-btn-primary")
      .trigger("click");

    await flushPromises();
  };
  const selectStatus = async (status: WatchStatus): Promise<void> => {
    await wrapper.get('select[aria-label="Статус просмотра"]').setValue(status);
    await flushPromises();
  };

  beforeEach(() => {
    route.params.id = "movie-id";
    mocks.update.mockReset();
    mocks.fetch.mockReset();
    vi.mocked(message.error).mockClear();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it("показывает прогресс, быстрые действия и дату начала", async () => {
    await render();
    expect(
      wrapper
        .findAll(".serial-progress__fill")
        .map((e) => e.attributes("style"))
    ).toEqual(["width: 33%;", "width: 25%;"]);

    expect(wrapper.get(".serial-progress__date-chips").text()).toContain(
      "Начал 2 октября"
    );

    await button("Увеличить эпизод").trigger("click");
    await flushPromises();
    expect(mocks.update).toHaveBeenCalledWith("owner", "movie-id", {
      currentEpisode: 4,
    });

    expect(wrapper.findAll(".serial-progress__label-value")[1].text()).toBe(
      "4 / 12"
    );

    await button("Уменьшить сезон").trigger("click");
    await flushPromises();
    expect(button("Уменьшить сезон").attributes("disabled")).toBeDefined();
    await button("Увеличить сезон").trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".serial-progress__label-value")[0].text()).toBe(
      "1 / 3"
    );

    await button("Уменьшить эпизод").trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".serial-progress__label-value")[1].text()).toBe(
      "3 / 12"
    );
  });

  it("ограничивает быстрые действия нулём и известным количеством", async () => {
    await render(createMovie({ currentSeason: 0, currentEpisode: 12 }));
    expect(button("Уменьшить сезон").attributes("disabled")).toBeDefined();
    expect(button("Увеличить эпизод").attributes("disabled")).toBeDefined();
    await edit();
    expect(
      wrapper
        .get('input[aria-label="На каком сезоне"]')
        .attributes("aria-valuemax")
    ).toBe("3");

    expect(
      wrapper
        .get('input[aria-label="На какой серии"]')
        .attributes("aria-valuemax")
    ).toBe("12");
  });

  it("при неизвестных итогах показывает текущие значения и допускает ввод в общих границах", async () => {
    const movie = createMovie();

    movie.movie = {
      ...movie.movie,
      seasonCount: undefined,
      episodeCount: undefined,
      contentKind: "TV_SHOW",
    };

    await render(movie);
    expect(wrapper.get(".serial-progress").text()).toContain(
      "Всего серий пока неизвестно. Текущий сезон: 1, выпуск: 3."
    );

    expect(wrapper.findAll(".serial-progress__seg-btn")).toHaveLength(0);
    await edit();
    expect(
      wrapper
        .get('input[aria-label="На каком сезоне"]')
        .attributes("aria-valuemax")
    ).toBe("100");

    expect(
      wrapper
        .get('input[aria-label="На какой серии"]')
        .attributes("aria-valuemax")
    ).toBe("5000");

    await wrapper.get('input[aria-label="На каком сезоне"]').setValue("100");
    await wrapper.get('input[aria-label="На какой серии"]').setValue("5000");
    await save();
    expect(mocks.update).toHaveBeenCalledWith("owner", "movie-id", {
      currentSeason: 100,
      currentEpisode: 5000,
    });
  });

  it.each(["4", "-1", "1.", "аб"])(
    "не сохраняет недопустимый прогресс %s",
    async (value) => {
      const label = value === "1." ? "На какой серии" : "На каком сезоне";

      await render();
      await edit();
      await wrapper.get(`input[aria-label="${label}"]`).setValue(value);
      await save();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(wrapper.find(".serial-progress_editing").exists()).toBe(true);
    }
  );

  it("отменяет ввод кнопкой и Escape без запроса", async () => {
    await render();
    await edit();
    await wrapper.get('input[aria-label="На каком сезоне"]').setValue("2");
    await wrapper.get(".serial-progress__edit-actions button").trigger("click");
    await edit();
    expect(
      (
        wrapper.get('input[aria-label="На каком сезоне"]')
          .element as HTMLInputElement
      ).value
    ).toBe("1");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.find(".serial-progress_editing").exists()).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("сохраняет редактор после ошибки и отображает полученный статус после повтора", async () => {
    await render();
    await edit();
    await wrapper.get('input[aria-label="На какой серии"]').setValue("12");
    mocks.update.mockRejectedValueOnce(new Error("offline"));
    await save();
    expect(wrapper.find(".serial-progress_editing").exists()).toBe(true);
    mocks.update.mockResolvedValueOnce(
      createMovie({ currentEpisode: 12, watchStatus: WatchStatus.COMPLETED })
    );

    await save();
    expect(wrapper.find(".serial-progress_editing").exists()).toBe(false);
    expect(wrapper.get(".serial-progress__completed").text()).toContain(
      "Сериал просмотрен полностью"
    );

    expect(
      (
        wrapper.get('select[aria-label="Статус просмотра"]')
          .element as HTMLSelectElement
      ).value
    ).toBe("COMPLETED");
  });

  it("блокирует быстрые действия и выбор статуса до окончания сохранения", async () => {
    await render();

    let finish!: (value: UserMovie) => void;

    mocks.update.mockReturnValueOnce(
      new Promise<UserMovie>((resolve) => {
        finish = resolve;
      })
    );

    await button("Увеличить эпизод").trigger("click");
    expect(
      wrapper
        .findAll(".serial-progress__seg-btn")
        .every((e) => e.attributes("disabled") !== undefined)
    ).toBe(true);

    expect(
      wrapper
        .get('select[aria-label="Статус просмотра"]')
        .attributes("disabled")
    ).toBeDefined();

    finish(createMovie({ currentEpisode: 4 }));
    await flushPromises();
    expect(button("Увеличить эпизод").attributes("disabled")).toBeUndefined();
  });

  it("при начале просмотра заполняет только отсутствующий прогресс с известными итогами", async () => {
    await render(
      createMovie({
        watchStatus: WatchStatus.NOT_STARTED,
        currentSeason: 0,
        currentEpisode: 5,
      })
    );

    await selectStatus(WatchStatus.WATCHING);
    expect(mocks.update).toHaveBeenCalledWith("owner", "movie-id", {
      watchStatus: WatchStatus.WATCHING,
      currentSeason: 1,
    });

    expect(wrapper.findAll(".serial-progress__label-value")[1].text()).toBe(
      "5 / 12"
    );
  });

  it("при завершении заполняет известные итоги, при сбросе сохраняет прогресс", async () => {
    await render();
    await selectStatus(WatchStatus.COMPLETED);
    expect(mocks.update).toHaveBeenLastCalledWith("owner", "movie-id", {
      watchStatus: WatchStatus.COMPLETED,
      currentSeason: 3,
      currentEpisode: 12,
    });

    await selectStatus(WatchStatus.NOT_STARTED);
    expect(mocks.update).toHaveBeenLastCalledWith("owner", "movie-id", {
      watchStatus: WatchStatus.NOT_STARTED,
    });

    expect(wrapper.find(".serial-progress__date-chips").exists()).toBe(false);
  });

  it("при неизвестных итогах смена статуса не придумывает номера сезонов и серий", async () => {
    const movie = createMovie({
      watchStatus: WatchStatus.NOT_STARTED,
      currentSeason: null,
      currentEpisode: null,
    });

    movie.movie = {
      ...movie.movie,
      seasonCount: undefined,
      episodeCount: undefined,
    };

    await render(movie);
    await selectStatus(WatchStatus.WATCHING);
    expect(mocks.update).toHaveBeenLastCalledWith("owner", "movie-id", {
      watchStatus: WatchStatus.WATCHING,
    });

    await selectStatus(WatchStatus.COMPLETED);
    expect(mocks.update).toHaveBeenLastCalledWith("owner", "movie-id", {
      watchStatus: WatchStatus.COMPLETED,
    });
  });

  it("при прекращении просмотра передаёт дату и оставляет прежний статус после ошибки", async () => {
    await render();
    mocks.update.mockRejectedValueOnce(new Error("offline"));
    await selectStatus(WatchStatus.DROPPED);

    const payload = mocks.update.mock.calls[0][2];

    expect(payload.watchStatus).toBe(WatchStatus.DROPPED);
    expect(Number.isFinite(Date.parse(payload.lastWatchedAt))).toBe(true);
    expect(wrapper.get(".serial-progress__status-value").text()).toBe("Смотрю");
    await selectStatus(WatchStatus.WATCHING);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("сохраняет отсутствие ограничения процента в детальной карточке", async () => {
    await render(createMovie({ currentSeason: 6, currentEpisode: 24 }));
    expect(
      wrapper
        .findAll(".serial-progress__fill")
        .map((e) => e.attributes("style"))
    ).toEqual(["width: 200%;", "width: 200%;"]);
  });

  it("при смене тайтла закрывает редактор, у фильма нет блока прогресса", async () => {
    await render();
    await edit();

    const film = createMovie();

    film.movie = { ...film.movie, isSerial: false };
    mocks.fetch.mockResolvedValueOnce(film);
    route.params.id = "film-id";
    await flushPromises();
    expect(wrapper.find(".serial-progress_editing").exists()).toBe(false);
    expect(wrapper.find(".serial-progress").exists()).toBe(false);
  });

  it("не увеличивает прогресс сверх общих ограничений при завышенных итогах", async () => {
    const movie = createMovie({ currentSeason: 100, currentEpisode: 5000 });

    movie.movie = { ...movie.movie, seasonCount: 150, episodeCount: 6000 };
    await render(movie);
    expect(button("Увеличить сезон").attributes("disabled")).toBeDefined();
    expect(button("Увеличить эпизод").attributes("disabled")).toBeDefined();
    await edit();
    expect(
      wrapper
        .get('input[aria-label="На каком сезоне"]')
        .attributes("aria-valuemax")
    ).toBe("100");

    expect(
      wrapper
        .get('input[aria-label="На какой серии"]')
        .attributes("aria-valuemax")
    ).toBe("5000");
  });

  it.each(["быстрое действие", "редактор", "статус"])(
    "не возвращает прежнюю карточку поздним ответом: %s",
    async (action) => {
      await render();

      let finish!: (value: UserMovie) => void;

      mocks.update.mockReturnValueOnce(
        new Promise<UserMovie>((resolve) => {
          finish = resolve;
        })
      );

      if (action === "редактор") {
        await edit();
        await save();
      } else if (action === "статус") await selectStatus(WatchStatus.COMPLETED);
      else await button("Увеличить эпизод").trigger("click");

      const next = createMovie({ movieId: "second", currentEpisode: 7 });

      next.movie = { ...next.movie, id: "second", title: "Второй сериал" };
      mocks.fetch.mockResolvedValueOnce(next);
      route.params.id = "second";
      await flushPromises();
      finish(createMovie({ currentEpisode: 4 }));
      await flushPromises();
      expect(wrapper.get("h1").text()).toBe("Второй сериал");
      expect(wrapper.findAll(".serial-progress__label-value")[1].text()).toBe(
        "7 / 12"
      );

      expect(button("Увеличить эпизод").attributes("disabled")).toBeUndefined();
    }
  );

  it("поздняя ошибка старого тайтла не мешает сохранению нового", async () => {
    await render();

    let fail!: (reason: Error) => void;
    let finishNext!: (value: UserMovie) => void;

    mocks.update.mockReturnValueOnce(
      new Promise<UserMovie>((_resolve, reject) => {
        fail = reject;
      })
    );

    await button("Увеличить эпизод").trigger("click");

    const next = createMovie({ movieId: "second", currentEpisode: 7 });

    next.movie = { ...next.movie, id: "second", title: "Второй сериал" };
    mocks.fetch.mockResolvedValueOnce(next);
    route.params.id = "second";
    await flushPromises();
    expect(button("Увеличить эпизод").attributes("disabled")).toBeUndefined();
    mocks.update.mockReturnValueOnce(
      new Promise<UserMovie>((resolve) => {
        finishNext = resolve;
      })
    );

    await button("Увеличить эпизод").trigger("click");
    fail(new Error("late failure"));
    await flushPromises();
    expect(message.error).not.toHaveBeenCalled();
    expect(button("Увеличить эпизод").attributes("disabled")).toBeDefined();
    finishNext({ ...next, currentEpisode: 8 });
    await flushPromises();
    expect(wrapper.findAll(".serial-progress__label-value")[1].text()).toBe(
      "8 / 12"
    );
  });

  it("связывает видимые подписи с уникальными числовыми полями", async () => {
    await render();
    await edit();

    const labels = wrapper.findAll("label.serial-progress__edit-label");
    const ids = labels.map((label) => label.attributes("for"));

    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
    labels.forEach((label) => {
      const input = wrapper.get(`input[id="${label.attributes("for")}"]`);

      expect(input.attributes("aria-label")).toBe(label.text());
    });
  });
});
