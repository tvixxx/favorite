import { mount, flushPromises } from "@vue/test-utils";
import { Form } from "ant-design-vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import CreateMovie from "./CreateMovie.vue";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  addPersonal: vi.fn(),
  fetch: vi.fn(),
  addActor: vi.fn(),
  upload: vi.fn(),
  discard: vi.fn(),
}));
vi.mock("@/services/media", () => ({
  uploadImage: mocks.upload,
  discardImage: mocks.discard,
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock("@/state/state", () => ({
  useMainStore: () => ({ userData: { id: "user-id" } }),
}));
vi.mock("@/stores/movies/moviesStore", () => ({
  useMoviesStore: () => ({ createMovie: mocks.create }),
}));
vi.mock("@/stores", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useUserMoviesStore: () => ({
    isLoaded: true,
    addUserMovie: mocks.addPersonal,
    fetchUserMovies: mocks.fetch,
  }),
}));
vi.mock("@/stores/actors/actorsStore", () => ({
  useActorsStore: () => ({
    fetchActorsForPickers: vi.fn(),
    pickerActors: [],
    addActorByName: mocks.addActor,
  }),
}));
vi.mock("@/services/api", () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }) },
  getApiResponseMessage: vi.fn(),
  isApiConflictError: () => false,
}));

describe("Создание через форму", () => {
  it("показывает пять типов и не отправляет форму с пропущенным выбором", async () => {
    mocks.create.mockClear();
    const wrapper = render();
    await wrapper.get('input[placeholder="Например: Интерстеллар"]').setValue("Новый тайтл");
    await wrapper.get("textarea").setValue("Описание");
    for (const label of ["Фильм", "Сериал", "Аниме", "Мультфильм", "ТВ-шоу"]) {
      expect(wrapper.findAll("button").some(button => button.text() === label)).toBe(true);
    }

    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Выберите, что добавляете");
    wrapper.unmount();
  });

  it("передаёт аниме-сериал с прежним признаком серийности", async () => {
    mocks.create.mockReset().mockResolvedValue({ id: "movie-id" });
    mocks.fetch.mockResolvedValue(undefined);
    const wrapper = render();
    await wrapper.get('input[placeholder="Например: Интерстеллар"]').setValue("Новое аниме");
    await wrapper.get("textarea").setValue("Описание");
    const anime = wrapper.findAll("button").find(button => button.text() === "Аниме");
    expect(anime).toBeDefined();
    await anime!.trigger("click");
    await wrapper.get('select[aria-label="Страны"]').setValue(["CN"]);
    await wrapper.findAll("button").find(button => button.text() === "Драма")!.trigger("click");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.create).not.toHaveBeenCalled();
    await wrapper.get('[aria-label="Формат"]').findAll("button").find(button => button.text() === "Сериал")!.trigger("click");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ contentKind: "ANIME", isSerial: true, title: "Новое аниме", countryCodes: ["CN"] });
    wrapper.unmount();
  });

  it("передаёт личные параметры вместе с фильмом без второго запроса записи", async () => {
    mocks.create.mockReset().mockResolvedValue({ id: "movie-id" });
    mocks.addPersonal.mockResolvedValue({});
    mocks.fetch.mockResolvedValue(undefined);
    const wrapper = render();
    await wrapper
      .get('input[placeholder="Например: Интерстеллар"]')
      .setValue("Новый фильм");
    await chooseFilm(wrapper);
    await wrapper.get("textarea").setValue("Описание фильма");
    await wrapper.get("button.cm-pill--more").trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Научная фантастика")!
      .trigger("click");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      title: "Новый фильм",
      description: "Описание фильма",
      actorIds: [],
      genres: ["DRAMA", "Sci_fi"],
      collection: {
        watchStatus: "NOT_STARTED",
        personalRate: null,
        seeLater: false,
      },
    });
    expect(mocks.addPersonal).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("не отправляет фильм пока новый актёр не получил ID", async () => {
    mocks.create.mockClear();
    let finish!: (actor: { id: string }) => void;
    mocks.addActor.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const wrapper = render();
    await chooseFilm(wrapper);
    await wrapper
      .get('input[placeholder="Например: Интерстеллар"]')
      .setValue("Новый фильм");
    await wrapper.get("textarea").setValue("Описание фильма");
    wrapper
      .getComponent({ name: "ASelect" })
      .vm.$emit("change", ["Новый актёр"]);
    await wrapper.get("form").trigger("submit");
    expect(mocks.create).not.toHaveBeenCalled();
    finish({ id: "00000000-0000-4000-8000-000000000000" });
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.create.mock.calls[0][0].actorIds).toEqual([
      "00000000-0000-4000-8000-000000000000",
    ]);
    wrapper.unmount();
  });
});

describe("Необязательный постер", () => {
  let wrapper: ReturnType<typeof render>;

  afterEach(() => {
    wrapper?.unmount();
    vi.unstubAllGlobals();
  });

  const choosePoster = async (): Promise<void> => {
    const NativeURL = URL;

    vi.stubGlobal(
      "URL",
      class extends NativeURL {
        static createObjectURL() {
          return "blob:poster-test";
        }
        static revokeObjectURL() {}
      }
    );
    mocks.upload.mockResolvedValue({
      id: "poster-id",
      url: "https://media.example.test/poster.webp",
      thumbnailUrl: "https://media.example.test/thumbnail.webp",
      width: 800,
      height: 1200,
      byteSize: 1024,
    });
    mocks.discard.mockResolvedValue(undefined);
    const input = wrapper.get('input[type="file"]');

    Object.defineProperty(input.element, "files", {
      value: [new File(["poster"], "poster.png", { type: "image/png" })],
      configurable: true,
    });
    await input.trigger("change");
    await flushPromises();
  };

  it("сохраняет ошибки обязательных полей после загрузки и удаления необязательного постера", async () => {
    wrapper = render(true);
    await wrapper.get("form").trigger("submit");
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("Введите название");
    });
    await choosePoster();
    await vi.waitFor(() => {
      expect(wrapper.text()).not.toContain(
        "Выберите изображение или вставьте ссылку"
      );
    });
    expect(wrapper.text()).toContain("Введите название");
    expect(wrapper.text()).toContain("Добавьте описание");

    const removeButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "Убрать изображение");

    expect(removeButton).toBeDefined();
    await removeButton!.trigger("click");
    await wrapper.get("form").trigger("submit");
    await vi.waitFor(() => {
      expect(wrapper.text()).not.toContain(
        "Выберите изображение или вставьте ссылку"
      );
      expect(wrapper.text()).toContain("Добавьте описание");
    });
  });

  it("сохраняет заполненную форму без постера, не отправляя фиктивный URL", async () => {
    mocks.create.mockReset().mockResolvedValue({ id: "movie-id" });
    mocks.fetch.mockResolvedValue(undefined);
    wrapper = render(true);
    await wrapper.get('input[placeholder="Например: Интерстеллар"]').setValue("Без постера");
    await chooseFilm(wrapper);
    await wrapper.get("textarea").setValue("Описание фильма");
    await wrapper.get("form").trigger("submit");
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create.mock.calls[0][0].imageUrl).toBeUndefined();
    expect(mocks.create.mock.calls[0][0].posterAssetId).toBeUndefined();
  });

  it("не показывает ошибку постера при очистке успешно сохранённой формы", async () => {
    mocks.create.mockReset().mockResolvedValue({ id: "movie-id" });
    mocks.fetch.mockResolvedValue(undefined);
    wrapper = render(true);
    await wrapper
      .get('input[placeholder="Например: Интерстеллар"]')
      .setValue("Новый фильм");
    await chooseFilm(wrapper);
    await wrapper.get("textarea").setValue("Описание фильма");
    await choosePoster();
    await wrapper.get("form").trigger("submit");
    await vi.waitFor(() => {
      expect(mocks.create).toHaveBeenCalledOnce();
      expect(wrapper.get('img[alt="Предпросмотр постера"]').attributes("src")).toMatch(/^data:image\/svg\+xml/);
    });
    expect(wrapper.text()).not.toContain(
      "Выберите изображение или вставьте ссылку"
    );
  });
});

async function chooseFilm(wrapper: ReturnType<typeof render>): Promise<void> {
  await wrapper.findAll("button").find(button => button.text() === "Фильм")!.trigger("click");
  await wrapper.findAll("button").find(button => button.text() === "Драма")!.trigger("click");
  await wrapper.get('select[aria-label="Страны"]').setValue(["US"]);
}

function render(realForm = false) {
  if (realForm) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  }

  return mount(CreateMovie, {
    global: {
      components: { AForm: Form, AFormItem: Form.Item },
      stubs: {
        AppBackButton: true,
        BaseIcon: true,
        WatchStatusSelect: true,
        "a-form": realForm
          ? false
          : {
              emits: ["finish"],
              methods: { resetFields: vi.fn() },
              template:
                "<form @submit.prevent=\"$emit('finish')\"><slot/></form>",
            },
        "a-form-item": realForm ? false : { template: "<div><slot/></div>" },
        "a-input": {
          props: ["value", "placeholder", "size"],
          emits: ["update:value"],
          template:
            '<input :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)"/>',
        },
        "a-textarea": {
          props: ["value"],
          emits: ["update:value"],
          template:
            '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)"/>',
        },
        "a-button": { template: "<button><slot/></button>" },
        "a-select": {
          name: "ASelect",
          props: ["value", "options"],
          emits: ["update:value", "change"],
          template: `<select multiple :aria-label="options?.length ? 'Страны' : 'Актёры'" :value="value" @change="$emit('update:value', Array.from($event.target.selectedOptions).map(option => option.value))"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>`,
        },
        "a-select-option": true,
        "a-date-picker": true,
        "a-switch": true,
        "a-input-number": true,
        "a-rate": true,
      },
    },
  });
}
