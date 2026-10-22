import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserSearchInput from "./UserSearchInput.vue";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/services/api", () => ({ default: api }));
beforeEach(() => api.get.mockReset());
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Выбор человека для заявки", () => {
  it("не анимирует начальный блок при открытии и очистке, но анимирует результат поиска", async () => {
    vi.useFakeTimers();
    api.get.mockResolvedValue({ data: [] });

    const wrapper = mount(UserSearchInput);

    expect(wrapper.get(".user-search__state").classes()).not.toContain(
      "fv-friend-enter"
    );

    await wrapper.get("input").setValue("Нет");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.get(".user-search__state").classes()).toContain(
      "fv-friend-enter"
    );

    await wrapper.get("input").setValue("");
    expect(wrapper.text()).toContain("Кого вы хотите добавить?");
    expect(wrapper.get(".user-search__state").classes()).not.toContain(
      "fv-friend-enter"
    );

    wrapper.unmount();
  });

  it("сохраняет выдачу при ошибке обновления, но разрешает выбрать её только после успешного повтора", async () => {
    vi.useFakeTimers();

    const person = { id: "anna", fullName: "Анна" };

    api.get
      .mockResolvedValueOnce({ data: [person] })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: [person] });

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("Ан");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const card = wrapper.get(".user-search__result").element;

    await wrapper.get("input").setValue("Анна");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.get(".user-search__result").element).toBe(card);
    expect(
      wrapper.get(".user-search__result").attributes("disabled")
    ).toBeDefined();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Показана предыдущая выдача"
    );

    await wrapper.get(".user-search__retry").trigger("click");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.get(".user-search__result").element).toBe(card);
    expect(
      wrapper.get(".user-search__result").attributes("disabled")
    ).toBeUndefined();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("не пересоздаёт выдачу и карточки, если новый ответ содержит тот же набор людей", async () => {
    vi.useFakeTimers();

    const people = [
      { id: "anna", fullName: "Анна Волкова" },
      { id: "alex", fullName: "Александр" },
    ];
    let finish!: (value: unknown) => void;

    api.get.mockResolvedValueOnce({ data: people }).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("Ан");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const cards = wrapper
      .findAll(".user-search__result")
      .map((card) => card.element);
    const animated = cards[0].closest(".fv-friend-enter");
    const status = wrapper.get(".user-search__status").element;

    expect(status.closest(".fv-friend-enter")).toBeNull();

    await wrapper.get("input").setValue("А");
    await wrapper.get("input").setValue("Алек");
    await vi.advanceTimersByTimeAsync(300);
    expect(
      wrapper.findAll(".user-search__result").map((card) => card.element)
    ).toEqual(cards);

    expect(wrapper.get(".user-search__status").text()).toBe(
      "Выберите нужного человека"
    );

    expect(wrapper.text()).not.toContain("Обновляем результаты");
    expect(
      wrapper.get(".user-search__result").attributes("disabled")
    ).toBeDefined();

    finish({ data: [...people].reverse().map((person) => ({ ...person })) });
    await flushPromises();

    const updated = wrapper.findAll(".user-search__result");

    expect(updated[0].element).toBe(cards[1]);
    expect(updated[1].element).toBe(cards[0]);
    expect(updated[0].element.closest(".fv-friend-enter")).toBe(animated);
    expect(wrapper.get(".user-search__status").element).toBe(status);
    expect(updated[0].attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });

  it("включает новое появление только при изменении набора найденных людей", async () => {
    vi.useFakeTimers();
    api.get
      .mockResolvedValueOnce({ data: [{ id: "anna", fullName: "Анна" }] })
      .mockResolvedValueOnce({ data: [{ id: "max", fullName: "Максим" }] });

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("Анна");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const first = wrapper
      .get(".user-search__result")
      .element.closest(".fv-friend-enter");

    await wrapper.get("input").setValue("Максим");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.get(".user-search__result").text()).toContain("Максим");
    expect(
      wrapper.get(".user-search__result").element.closest(".fv-friend-enter")
    ).not.toBe(first);

    wrapper.unmount();
  });

  it("сохраняет пустое состояние без повторного появления, если оба поиска ничего не нашли", async () => {
    vi.useFakeTimers();

    let finish!: (value: unknown) => void;

    api.get.mockResolvedValueOnce({ data: [] }).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("Нет");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const empty = wrapper.get(".user-search__state").element;

    await wrapper.get("input").setValue("Нетт");
    await vi.advanceTimersByTimeAsync(300);
    expect(wrapper.get(".user-search__state").element).toBe(empty);
    expect(wrapper.text()).toContain("Никого не нашли");
    finish({ data: [] });
    await flushPromises();
    expect(wrapper.get(".user-search__state").element).toBe(empty);
    wrapper.unmount();
  });

  it("сохраняет пустую выдачу во время нового ввода без промежуточного приглашения", async () => {
    vi.useFakeTimers();
    api.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: "anna", fullName: "Анна" }] });

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("Нет");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.text()).toContain("Никого не нашли");
    await wrapper.get("input").setValue("Анна");
    await vi.advanceTimersByTimeAsync(299);
    expect(wrapper.text()).toContain("Никого не нашли");
    expect(wrapper.text()).not.toContain("Кого вы хотите добавить");
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(wrapper.get(".user-search__result").text()).toContain("Анна");
    wrapper.unmount();
  });

  it("показывает прежние результаты во время debounce, но запрещает выбрать устаревшую карточку", async () => {
    vi.useFakeTimers();
    api.get.mockResolvedValue({ data: [{ id: "anna", fullName: "Анна" }] });

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("Анна");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    await wrapper.get("input").setValue("Максим");

    const previous = wrapper.get(".user-search__result");

    expect(previous.text()).toContain("Анна");
    expect(previous.attributes("disabled")).toBeDefined();
    await previous.trigger("click");
    expect(
      wrapper
        .emitted("update:modelValue")
        ?.some((values) => (values[0] as { id?: string } | null)?.id === "anna")
    ).toBeFalsy();

    wrapper.unmount();
  });

  it("ждёт 300 мс после последнего символа и не включает загрузку во время ввода", async () => {
    vi.useFakeTimers();

    let finish!: (value: unknown) => void;

    api.get.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("Ан");
    await vi.advanceTimersByTimeAsync(200);
    await wrapper.get("input").setValue("Анна");
    await vi.advanceTimersByTimeAsync(299);
    expect(api.get).not.toHaveBeenCalled();
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Ищем людей");
    await vi.advanceTimersByTimeAsync(1);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get.mock.calls[0][1].params).toEqual({ query: "Анна" });
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true);
    finish({ data: [] });
    await flushPromises();
    wrapper.unmount();
  });

  it("показывает ошибку и повторяет тот же запрос", async () => {
    vi.useFakeTimers();
    api.get
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: [] });

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("Анна");
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Ищем людей");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.text()).toContain("Не удалось выполнить поиск");
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Повторить поиск")!
      .trigger("click");

    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get.mock.calls[1][1].params).toEqual({ query: "Анна" });
    expect(wrapper.text()).toContain("Никого не нашли");
    wrapper.unmount();
  });

  it("отменяет запрос при закрытии и не интерпретирует имя как разметку", async () => {
    vi.useFakeTimers();
    api.get.mockResolvedValue({
      data: [
        {
          id: "person",
          fullName: '<img src=x onerror="alert(1)">',
          username: "safe_nick",
        },
      ],
    });

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("Поиск");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.text()).toContain('<img src=x onerror="alert(1)">');
    expect(wrapper.find("img").exists()).toBe(false);

    const signal = api.get.mock.calls[0][1].signal as AbortSignal;

    wrapper.unmount();
    expect(signal.aborted).toBe(true);
  });

  it("ищет по введённому запросу и требует выбрать конкретного человека среди совпадений", async () => {
    vi.useFakeTimers();
    api.get.mockResolvedValue({
      data: [
        { id: "first", fullName: "Александр", username: "sasha_one" },
        { id: "second", fullName: "Александр", username: "sasha_two" },
      ],
    });

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("А");
    await vi.advanceTimersByTimeAsync(300);
    expect(api.get).not.toHaveBeenCalled();
    await wrapper.get("input").setValue("Александр");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.find('button[aria-pressed="true"]').exists()).toBe(false);
    await wrapper.findAll("button")[1].trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      expect.objectContaining({ id: "second", username: "sasha_two" }),
    ]);

    await wrapper.get("input").setValue("Другой");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([null]);
    wrapper.unmount();
  });

  it("не показывает поздний ответ после смены запроса", async () => {
    vi.useFakeTimers();

    let finish!: (value: unknown) => void;

    api.get
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValueOnce({ data: [{ id: "new", fullName: "Новый" }] });

    const wrapper = mount(UserSearchInput);

    await wrapper.get("input").setValue("Старый");
    await vi.advanceTimersByTimeAsync(300);
    await wrapper.get("input").setValue("Новый");
    await vi.advanceTimersByTimeAsync(300);
    finish({ data: [{ id: "old", fullName: "Старый" }] });
    await flushPromises();
    expect(
      wrapper.findAll(".user-search__result strong").map((name) => name.text())
    ).toEqual(["Новый"]);

    wrapper.unmount();
  });
});
