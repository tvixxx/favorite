import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WatchTonightModal from "./WatchTonightModal.vue";

const mocks = vi.hoisted(() => ({ get: vi.fn(), push: vi.fn() }));
const main = reactive({ userData: { id: "owner" }, sessionRevision: 0 });

vi.mock("@/services/api", () => ({ default: { get: mocks.get } }));
vi.mock("@/state/state", () => ({ useMainStore: () => main }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.push }) }));

const row = (id: string, extra = {}) => ({
  userId: "owner",
  movieId: id,
  seeLater: true,
  watchStatus: "NOT_STARTED",
  movie: {
    id,
    title: `Тайтл ${id}`,
    isSerial: false,
    contentKind: null,
    genres: ["DRAMA"],
    publishDate: "2020-01-01",
    poster: null,
  },
  ...extra,
});
let wrapper: ReturnType<typeof mount>;
const open = async () => {
  wrapper = mount(WatchTonightModal, {
    props: { modelValue: false },
    global: {
      stubs: {
        ASelect: {
          props: ["value", "options"],
          emits: ["update:value"],
          template:
            '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{option.label}}</option></select>',
        },
        BaseModal: {
          props: ["modelValue"],
          template:
            '<section v-if="modelValue"><slot name="title"/><slot name="body"/><slot name="footer"/></section>',
        },
        BaseIcon: true,
      },
    },
  });

  await wrapper.setProps({ modelValue: true });
  await flushPromises();
};

const click = async (label: string) => {
  await wrapper
    .findAll("button")
    .find((b) => b.text() === label)!
    .trigger("click");

  await flushPromises();
};

beforeEach(() => {
  mocks.get.mockReset();
  mocks.push.mockReset();
  main.userData.id = "owner";
  main.sessionRevision = 0;
  vi.spyOn(Math, "random").mockReturnValue(0.4);
});

afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
});

describe("Что посмотреть сегодня", () => {
  it("догружает весь список и не включает просмотренное, начатое и чужие фильтры страницы", async () => {
    mocks.get
      .mockResolvedValueOnce({ data: { total: 2, items: [row("a")] } })
      .mockResolvedValueOnce({ data: { total: 2, items: [row("b")] } });

    await open();
    expect(mocks.get).toHaveBeenCalledTimes(2);

    const queries = mocks.get.mock.calls.map(
      (call) => new URL(call[0], "http://localhost").searchParams
    );

    expect(Object.fromEntries(queries[0])).toEqual({
      seeLater: "true",
      watchStatus: "NOT_STARTED",
      limit: "100",
      offset: "0",
    });

    expect(queries[1].get("offset")).toBe("1");
    expect(wrapper.text()).toContain("Подходят 2 тайтла");

    const names = [wrapper.get("h3").text()];

    await click("Другой вариант");
    names.push(wrapper.get("h3").text());
    expect(new Set(names)).toEqual(new Set(["Тайтл a", "Тайтл b"]));
    expect(wrapper.text()).toContain("Все подходящие варианты показаны");
    await click("Начать заново");
    expect(wrapper.text()).not.toContain("Все подходящие варианты показаны");
  });

  it("фильтрует пять типов, старые null категории и жанры через настоящий интерфейс", async () => {
    const movies = [
      row("film"),
      row("series", { movie: { ...row("series").movie, isSerial: true } }),
      ...["ANIME", "ANIMATION", "TV_SHOW"].map((kind) =>
        row(kind, {
          movie: { ...row(kind).movie, contentKind: kind, genres: ["COMEDY"] },
        })
      ),
    ];

    mocks.get.mockResolvedValue({
      data: { total: movies.length, items: movies },
    });

    await open();
    for (const [value, title] of [
      ["film", "film"],
      ["series", "series"],
      ["ANIME", "ANIME"],
      ["ANIMATION", "ANIMATION"],
      ["TV_SHOW", "TV_SHOW"],
    ]) {
      await wrapper.get('select[id="watch-tonight-kind"]').setValue(value);
      expect(wrapper.get("h3").text()).toBe(`Тайтл ${title}`);
    }

    await wrapper.get('select[id="watch-tonight-genre"]').setValue("DRAMA");
    expect(wrapper.text()).toContain("Попробуйте другие фильтры");
    await click("Сбросить фильтры");
    expect(wrapper.text()).toContain("Подходят 5 тайтлов");
  });

  it("отличает пустой список от одного кандидата и открывает правильную карточку", async () => {
    mocks.get.mockResolvedValue({ data: { total: 1, items: [row("only")] } });
    await open();
    expect(wrapper.text()).toContain("Это единственный подходящий тайтл");
    expect(
      wrapper
        .findAll("button")
        .find((b) => b.text() === "Другой вариант")!
        .attributes("disabled")
    ).toBeDefined();

    await click("Открыть карточку");
    expect(mocks.push).toHaveBeenCalledWith("/detail/only");
    expect(wrapper.emitted("update:modelValue")).toContainEqual([false]);
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("показывает пустой список и переход в каталог", async () => {
    mocks.get.mockResolvedValue({ data: { total: 0, items: [] } });
    await open();
    expect(wrapper.text()).toContain("Добавьте тайтлы на потом");
    await click("Открыть каталог");
    expect(mocks.push).toHaveBeenCalledWith("/library/catalog");
  });

  it("повторяет после ошибки и не выдаёт изменившуюся пагинацию за полный список", async () => {
    mocks.get
      .mockResolvedValueOnce({ data: { total: 2, items: [row("a")] } })
      .mockResolvedValueOnce({ data: { total: 3, items: [row("b")] } });

    await open();
    expect(wrapper.text()).toContain("Не удалось загрузить список");
    mocks.get.mockResolvedValue({ data: { total: 1, items: [row("good")] } });
    await click("Повторить");
    expect(wrapper.get("h3").text()).toBe("Тайтл good");
  });

  it.each(["закрытие", "смена аккаунта"])(
    "не показывает поздний ответ: %s",
    async (action) => {
      let finish!: (value: unknown) => void;

      mocks.get.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        })
      );

      await open();
      if (action === "закрытие") await wrapper.setProps({ modelValue: false });
      else main.sessionRevision++;
      expect(mocks.get.mock.calls[0][1].signal.aborted).toBe(true);
      finish({ data: { total: 1, items: [row("secret")] } });
      await flushPromises();
      expect(wrapper.text()).not.toContain("Тайтл secret");
      expect(mocks.push).not.toHaveBeenCalled();
    }
  );

  it.each(["чужая запись", "повтор строки"])(
    "не показывает недостоверный ответ: %s",
    async (issue) => {
      const items =
        issue === "чужая запись"
          ? [row("private", { userId: "another-owner" })]
          : [row("same"), row("same")];

      mocks.get.mockResolvedValue({ data: { total: items.length, items } });
      await open();
      expect(wrapper.text()).toContain("Не удалось загрузить список");
      expect(
        wrapper
          .findAll("button")
          .some((button) => button.text() === "Открыть карточку")
      ).toBe(false);
    }
  );

  it("не выбирает начатые или просмотренные тайтлы даже при лишних строках ответа", async () => {
    mocks.get.mockResolvedValue({
      data: {
        total: 4,
        items: [
          row("watching", { watchStatus: "WATCHING" }),
          row("completed", { watchStatus: "COMPLETED" }),
          row("later-false", { seeLater: false }),
          row("eligible"),
        ],
      },
    });

    await open();
    expect(wrapper.get("h3").text()).toBe("Тайтл eligible");
    expect(wrapper.text()).toContain("Это единственный подходящий тайтл");
  });
});
