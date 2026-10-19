import { reactive } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { Button, Input } from "ant-design-vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddMovieToListModal from "./AddMovieToListModal.vue";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  fetchLists: vi.fn(),
  create: vi.fn(),
  add: vi.fn(),
  conflict: new Error("conflict"),
}));
const list = (id: string, name: string) => ({
  id,
  userId: "owner",
  name,
  color: "#ff0032",
  labels: ["кино"],
  _count: { items: 1 },
});
const state = reactive({
  sortedLists: [
    list("a", "Вечер"),
    list("b", "Семья"),
    list("broken", "Недоступный"),
  ],
  isLoading: false,
  isError: null,
  fetchLists: mocks.fetchLists,
  createList: mocks.create,
  addMovieToList: mocks.add,
});

vi.mock("@/stores", () => ({ useUserListsStore: () => state }));
vi.mock("@/composable", () => ({
  useFetch: mocks.fetch,
  FETCH_METHOD: { get: "GET" },
}));

vi.mock("@/services/api", () => ({
  getApiResponseMessage: () => undefined,
  isApiConflictError: (error: unknown) => error === mocks.conflict,
}));

vi.mock("ant-design-vue", async (original) => ({
  ...(await original<typeof import("ant-design-vue")>()),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

describe("Добавление произведения в пользовательский список", () => {
  let wrapper: ReturnType<typeof mount>;
  const render = (open = true) => {
    wrapper = mount(AddMovieToListModal, {
      props: { modelValue: open, userId: "owner", movieId: "movie-1" },
      global: {
        components: { AButton: Button, AInput: Input },
        stubs: {
          BaseModal: {
            props: ["modelValue"],
            template:
              '<section v-if="modelValue"><slot name="title"/><slot name="body"/><slot name="footer"/></section>',
          },
          BaseIcon: true,
          RowsSkeleton: true,
        },
      },
    });

    return wrapper;
  };
  const item = (name: string) => {
    const found = wrapper
      .findAll(".lists-modal__list-item")
      .find((row) => row.text().includes(name));

    if (!found) throw new Error(`Список ${name} не найден`);

    return found;
  };

  beforeEach(() => {
    state.sortedLists = [
      list("a", "Вечер"),
      list("b", "Семья"),
      list("broken", "Недоступный"),
    ];

    mocks.fetchLists.mockReset().mockResolvedValue(state.sortedLists);
    mocks.fetch.mockReset().mockImplementation(async (url: string) => {
      if (url.endsWith("/broken")) throw new Error("offline");

      return {
        status: 200,
        data: { items: url.endsWith("/a") ? [{ movieId: "movie-1" }] : [] },
      };
    });

    mocks.add.mockReset().mockResolvedValue(undefined);
    mocks.create
      .mockReset()
      .mockImplementation(
        async (
          userId: string,
          payload: { name: string; color: string; labels: string[] }
        ) => {
          const created = {
            ...list("created", payload.name),
            userId,
            color: payload.color,
            labels: payload.labels,
          };

          state.sortedLists = [...state.sortedLists, created];

          return created;
        }
      );
  });

  afterEach(() => wrapper?.unmount());

  it("загружает списки при открытии, учитывает присутствие и продолжает после ошибки одного списка", async () => {
    render(false);
    expect(mocks.fetchLists).not.toHaveBeenCalled();
    await wrapper.setProps({ modelValue: true });
    await flushPromises();
    expect(item("Вечер").find("button").exists()).toBe(false);
    expect(item("Семья").find("button").exists()).toBe(true);
    expect(item("Недоступный").exists()).toBe(true);
    await item("Семья").get("button").trigger("click");
    await flushPromises();
    expect(mocks.add).toHaveBeenCalledWith("owner", "b", "movie-1");
    expect(item("Семья").find("button").exists()).toBe(false);
  });

  it("создаёт список с выбранным цветом и уникальными метками, затем очищает форму", async () => {
    render();
    await flushPromises();
    await wrapper
      .get('input[placeholder="Название списка"]')
      .setValue("  Мой вечер  ");

    await wrapper
      .get('input[placeholder^="Метки через запятую"]')
      .setValue(" друзья, драма,друзья, ");

    const color = "#007CFF";
    const swatch = wrapper.get(`button[aria-label="Цвет ${color}"]`);

    await swatch.trigger("click");

    const create = wrapper
      .findAll("button")
      .find((button) => button.text() === "Создать список")!;

    await create.trigger("click");
    await flushPromises();
    expect(mocks.create).toHaveBeenCalledWith("owner", {
      name: "Мой вечер",
      color,
      labels: ["друзья", "драма"],
    });

    expect(item("Мой вечер").exists()).toBe(true);
    expect(
      (
        wrapper.get('input[placeholder="Название списка"]')
          .element as HTMLInputElement
      ).value
    ).toBe("");

    expect(
      (
        wrapper.get('input[placeholder^="Метки через запятую"]')
          .element as HTMLInputElement
      ).value
    ).toBe("");
  });

  it("при конфликте помечает тайтл как уже добавленный", async () => {
    mocks.add.mockRejectedValueOnce(mocks.conflict);
    render();
    await flushPromises();
    await item("Семья").get("button").trigger("click");
    await flushPromises();
    expect(item("Семья").find("button").exists()).toBe(false);
  });

  it("после сетевой ошибки оставляет возможность повторить добавление", async () => {
    mocks.add.mockRejectedValueOnce(new Error("offline"));
    render();
    await flushPromises();
    await item("Семья").get("button").trigger("click");
    await flushPromises();
    expect(item("Семья").find("button").exists()).toBe(true);
    await item("Семья").get("button").trigger("click");
    await flushPromises();
    expect(item("Семья").find("button").exists()).toBe(false);
  });

  it("закрывается по событию и сохраняет незавершённый ввод при повторном открытии", async () => {
    render();
    await flushPromises();
    await wrapper
      .get('input[placeholder="Название списка"]')
      .setValue("Черновик");

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Закрыть")!
      .trigger("click");

    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    await flushPromises();
    expect(
      (
        wrapper.get('input[placeholder="Название списка"]')
          .element as HTMLInputElement
      ).value
    ).toBe("Черновик");
  });

  it("поздняя проверка присутствия не возвращает кнопку после успешного добавления", async () => {
    let finish!: (value: {
      status: number;
      data: { items: { movieId: string }[] };
    }) => void;

    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.endsWith("/b"))
        return new Promise((resolve) => {
          finish = resolve;
        });

      return { status: 200, data: { items: [] } };
    });

    render();
    await flushPromises();
    await item("Семья").get("button").trigger("click");
    await flushPromises();
    expect(item("Семья").find("button").exists()).toBe(false);
    finish({ status: 200, data: { items: [] } });
    await flushPromises();
    expect(item("Семья").find("button").exists()).toBe(false);
  });

  it("повторное открытие использует новую проверку и не применяет старый ответ", async () => {
    let finish!: (value: {
      status: number;
      data: { items: { movieId: string }[] };
    }) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    render();
    await flushPromises();
    await wrapper.setProps({ modelValue: false });
    mocks.fetch.mockResolvedValue({ status: 200, data: { items: [] } });
    await wrapper.setProps({ modelValue: true });
    await flushPromises();
    expect(item("Вечер").find("button").exists()).toBe(true);
    finish({ status: 200, data: { items: [{ movieId: "movie-1" }] } });
    await flushPromises();
    expect(item("Вечер").find("button").exists()).toBe(true);
  });

  it("перепроверяет списки при смене тайтла и не переносит результат старого добавления", async () => {
    render();
    await flushPromises();

    let finish!: () => void;

    mocks.add.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );

    await item("Семья").get("button").trigger("click");
    mocks.fetch.mockResolvedValue({ status: 200, data: { items: [] } });
    await wrapper.setProps({ movieId: "movie-2" });
    await flushPromises();
    expect(item("Вечер").find("button").exists()).toBe(true);
    finish();
    await flushPromises();
    expect(item("Семья").find("button").exists()).toBe(true);
    await item("Семья").get("button").trigger("click");
    await flushPromises();
    expect(mocks.add).toHaveBeenLastCalledWith("owner", "b", "movie-2");
  });
});
