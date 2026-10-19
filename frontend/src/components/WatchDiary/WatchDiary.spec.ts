import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WatchDiary from "./WatchDiary.vue";
import type { DiaryEntry, DiaryPage } from "@/services/watch-diary";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  movies: vi.fn(),
}));
let session = reactive({
  userData: { id: "owner", timezone: "UTC" },
  sessionRevision: 0,
});

vi.mock("@/state/state", () => ({ useMainStore: () => session }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/services/api", () => ({ getApiResponseMessage: () => "" }));
vi.mock("@/services/watch-diary-api", () => ({
  listDiary: mocks.list,
  createDiary: mocks.create,
  updateDiary: mocks.update,
  removeDiary: mocks.remove,
  diaryMovies: mocks.movies,
}));

const entry = (note: string): DiaryEntry => ({
  id: "entry",
  viewedOn: "2026-10-17",
  scope: "TITLE",
  season: null,
  isRewatch: false,
  rating: 9,
  note,
  revision: 1,
  createdAt: "",
  updatedAt: "",
  inCollection: true,
  movie: {
    id: "movie",
    title: "Интерстеллар",
    titleEn: "Interstellar",
    isSerial: false,
    seasonCount: null,
    contentKind: "GENERAL",
    publishDate: null,
    imageUrl: null,
  },
});
const page = (note: string): DiaryPage => ({
  items: [entry(note)],
  total: 1,
  stats: { entries: 1, titles: 1, rewatches: 0 },
  today: "2026-10-17",
});
const render = (props = {}) =>
  mount(WatchDiary, {
    props,
    global: {
      stubs: {
        BaseIcon: true,
        MoviePoster: true,
        ConfirmDialog: true,
        DiaryForm: {
          props: ["modelValue", "duplicate"],
          emits: ["confirm"],
          template:
            "<div v-if=\"modelValue\"><p>{{ duplicate?.note }}</p><button data-confirm @click=\"$emit('confirm', { values: { viewedOn: '2026-10-17', scope: 'TITLE', season: null, isRewatch: false, rating: 9, note: 'Новая запись', syncStatus: false, syncRating: false }, movieId: 'movie', requestId: 'request', allowDuplicate: false })\">Подтвердить просмотр</button></div>",
        },
      },
    },
  });

describe("Загрузка личного дневника", () => {
  beforeEach(() => {
    session = reactive({
      userData: { id: "owner", timezone: "UTC" },
      sessionRevision: 0,
    });

    vi.clearAllMocks();
    mocks.list.mockResolvedValue(page("Моя заметка"));
    mocks.movies.mockResolvedValue([]);
  });

  it("по переходу из карточки показывает всю историю произведения без ограничения текущим месяцем", async () => {
    const wrapper = render({ movieIdFilter: "movie" });

    await flushPromises();

    const query = mocks.list.mock.calls[0]?.[1] as Record<string, unknown>;

    expect(query.movieId).toBe("movie");
    expect(query).not.toHaveProperty("from");
    expect(query).not.toHaveProperty("to");
    wrapper.unmount();
  });

  it("сбрасывает месяц отдельной доступной кнопкой и загружает всю историю", async () => {
    const wrapper = render();

    await flushPromises();
    expect(mocks.list.mock.calls.at(-1)?.[1]).toHaveProperty("from");
    await wrapper.get('button[aria-label="Сбросить месяц"]').trigger("click");
    await flushPromises();
    expect(mocks.list.mock.calls.at(-1)?.[1]).not.toHaveProperty("from");
    expect(mocks.list.mock.calls.at(-1)?.[1]).not.toHaveProperty("to");
    wrapper.unmount();
  });

  it("после смены пользователя не показывает заметки из позднего ответа старой сессии", async () => {
    let finish!: (value: DiaryPage) => void;

    mocks.list.mockImplementation((owner: string) =>
      owner === "owner"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(page("Новая личная заметка"))
    );

    const wrapper = render();

    session.userData = { id: "other", timezone: "UTC" };
    session.sessionRevision++;
    await flushPromises();
    expect(wrapper.text()).toContain("Новая личная заметка");
    finish(page("Чужая старая заметка"));
    await flushPromises();
    expect(wrapper.text()).not.toContain("Чужая старая заметка");
    wrapper.unmount();
  });

  it("показывает сетевую ошибку отдельно от пустого дневника и повторяет загрузку", async () => {
    mocks.list.mockRejectedValueOnce(new Error("offline"));

    const wrapper = render();

    await flushPromises();
    expect(wrapper.text()).toContain("Не удалось загрузить дневник");
    expect(wrapper.text()).not.toContain("Пока нет записей");
    await wrapper.get("[data-diary-retry]").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Моя заметка");
    wrapper.unmount();
  });

  it("оставляет форму открытой при совпадении и не сообщает об успешном сохранении", async () => {
    mocks.create.mockResolvedValue({
      status: "duplicate",
      entry: entry("Совпавшая запись"),
      collectionUpdated: false,
    });

    const wrapper = render();

    await flushPromises();
    await wrapper.get("[data-diary-add]").trigger("click");
    await wrapper.get("[data-confirm]").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Совпавшая запись");
    expect(wrapper.find("[data-confirm]").exists()).toBe(true);
    expect(wrapper.emitted("collectionUpdated")).toBeUndefined();
    wrapper.unmount();
  });

  it("завершает загрузку после ввода пробела вместо пустого поискового запроса", async () => {
    vi.useFakeTimers();
    mocks.list.mockImplementationOnce(() => new Promise(() => {}));

    const wrapper = render();

    try {
      await wrapper
        .get('input[placeholder="Название произведения"]')
        .setValue(" ");

      await vi.advanceTimersByTimeAsync(300);
      await flushPromises();
      expect(wrapper.text()).toContain("Моя заметка");
      expect(wrapper.get("section.watch-diary").attributes("aria-busy")).toBe(
        "false"
      );
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
    }
  });
});
