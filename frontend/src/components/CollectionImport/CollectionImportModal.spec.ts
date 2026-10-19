import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import CollectionImportModal from "./CollectionImportModal.vue";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
const store = reactive({ userData: { id: "qa-user" }, sessionRevision: 0 });

vi.mock("@/services/api", () => ({
  default: { post: mocks.post },
  getApiResponseMessage: (error: {
    response?: { data?: { message?: string } };
  }) => error.response?.data?.message,
}));

vi.mock("@/state/state", () => ({ useMainStore: () => store }));

const content = JSON.stringify({
  version: 1,
  movies: [{ title: "Фильм", isSerial: false, watchStatus: "COMPLETED" }],
});
const preview = {
  valid: true,
  ready: 1,
  existing: 0,
  errors: 0,
  proof: "checked-proof",
  rows: [
    {
      row: 1,
      title: "Фильм",
      watchStatus: "COMPLETED",
      isFavorite: false,
      personalRate: 0,
      status: "ready",
      issue: "",
    },
  ],
};
const render = () =>
  mount(CollectionImportModal, {
    props: { modelValue: true },
    global: {
      stubs: {
        BaseModal: {
          props: ["modelValue"],
          template:
            '<section><slot name="title"/><slot name="body"/><slot name="footer"/></section>',
        },
      },
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockReset();
  store.sessionRevision = 0;
});

describe("Обязательная проверка перед импортом коллекции", () => {
  it("отправляет снимок версии 2 с прогрессом и датами на серверную проверку", async () => {
    const wrapper = render();
    const file = JSON.stringify({
      version: 2,
      movies: [
        {
          title: "Сериал",
          year: null,
          isSerial: true,
          contentKind: null,
          watchStatus: "WATCHING",
          personalRate: null,
          isFavorite: false,
          seeLater: true,
          currentSeason: 2,
          currentEpisode: 3,
          addedAt: "2020-01-01T00:00:00Z",
          startedAt: null,
          completedAt: null,
          lastWatchedAt: null,
          droppedAt: null,
        },
      ],
    });

    mocks.post.mockResolvedValueOnce({ data: preview });
    await wrapper.get("textarea").setValue(file);
    await wrapper.get('[data-testid="import-check"]').trigger("click");
    await flushPromises();
    expect(mocks.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ content: file, format: "json" }),
      expect.any(Object)
    );

    expect(wrapper.text()).toContain("Будет добавлен");
    wrapper.unmount();
  });

  it("требует повторную проверку после явного выбора одноимённой карточки", async () => {
    const wrapper = render();

    await wrapper.get("textarea").setValue(content);
    mocks.post.mockResolvedValueOnce({
      data: {
        ...preview,
        valid: false,
        ready: 0,
        errors: 1,
        proof: null,
        rows: [
          {
            ...preview.rows[0],
            status: "error",
            issue: "Выберите карточку",
            candidates: [
              { id: "one", title: "Фильм", isSerial: false, year: 2020 },
              { id: "two", title: "Фильм", isSerial: false, year: 2024 },
            ],
          },
        ],
      },
    });

    await wrapper.get('[data-testid="import-check"]').trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[data-testid="import-commit"]').attributes("disabled")
    ).toBeDefined();

    const choice = wrapper.get('#collection-import-match-1[role="combobox"]');

    await choice.trigger("mousedown");
    await flushPromises();

    const option = wrapper
      .findAll(".ant-select-item-option")
      .find((item) => item.text().includes("2020"));

    expect(option).toBeDefined();
    await option!.trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[data-testid="import-commit"]').attributes("disabled")
    ).toBeDefined();

    mocks.post.mockResolvedValueOnce({ data: preview });
    await wrapper.get('[data-testid="import-check"]').trigger("click");
    await flushPromises();
    expect(mocks.post.mock.calls[1][1]).toMatchObject({
      matches: [{ row: 1, movieId: "one" }],
    });

    expect(
      wrapper.get('[data-testid="import-commit"]').attributes("disabled")
    ).toBeUndefined();

    await wrapper.get("textarea").setValue(content + " ");
    mocks.post.mockResolvedValueOnce({ data: preview });
    await wrapper.get('[data-testid="import-check"]').trigger("click");
    await flushPromises();
    expect(mocks.post.mock.calls[2][1].matches).toBeUndefined();
    wrapper.unmount();
  });

  it("показывает читаемый JSON по кнопке, сохраняя исходные данные и разрешение импорта", async () => {
    const wrapper = render();

    await wrapper.get("textarea").setValue(content);
    mocks.post.mockResolvedValue({ data: preview });
    await wrapper.get('[data-testid="import-check"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="import-readable"]').trigger("click");
    expect(wrapper.get('[data-testid="import-pretty"]').text()).toBe(
      JSON.stringify(JSON.parse(content), null, 2)
    );

    expect(
      wrapper.get('[data-testid="import-commit"]').attributes("disabled")
    ).toBeUndefined();

    await wrapper.get('[data-testid="import-readable"]').trigger("click");
    expect(wrapper.get<HTMLTextAreaElement>("textarea").element.value).toBe(
      content
    );

    wrapper.unmount();
  });

  it("показывает оба примера, не импортирует до проверки и сбрасывает разрешение при изменении файла", async () => {
    const wrapper = render();

    expect(wrapper.text()).toContain('"version": 1');
    expect(wrapper.text()).toContain("title,isSerial");

    const commit = () => wrapper.get('[data-testid="import-commit"]');

    expect(commit().attributes("disabled")).toBeDefined();
    await wrapper.get("textarea").setValue(content);
    mocks.post.mockResolvedValue({ data: preview });
    await wrapper.get('[data-testid="import-check"]').trigger("click");
    await flushPromises();
    expect(commit().attributes("disabled")).toBeUndefined();
    expect(wrapper.text()).toContain("Будет добавлен");
    await wrapper.get("textarea").setValue(content + " ");
    expect(commit().attributes("disabled")).toBeDefined();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("не отправляет невалидный JSON и слишком большой текст, игнорирует запоздалую проверку после редактирования", async () => {
    const wrapper = render();

    await wrapper.get("textarea").setValue("{broken");
    await wrapper.get('[data-testid="import-check"]').trigger("click");
    expect(mocks.post).not.toHaveBeenCalled();
    await wrapper.get("textarea").setValue("я".repeat(20000));
    await wrapper.get('[data-testid="import-check"]').trigger("click");
    expect(mocks.post).not.toHaveBeenCalled();

    let finish!: (value: unknown) => void;

    mocks.post.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    await wrapper.get("textarea").setValue(content);
    await wrapper.get('[data-testid="import-check"]').trigger("click");
    await wrapper.get("textarea").setValue(content + " ");
    finish({ data: preview });
    await flushPromises();
    expect(
      wrapper.get('[data-testid="import-commit"]').attributes("disabled")
    ).toBeDefined();

    wrapper.unmount();
  });

  it("отправляет ровно проверенные данные и подтверждение, показывает результат и обновляет коллекцию событием", async () => {
    const wrapper = render();

    await wrapper.get("textarea").setValue(content);
    mocks.post
      .mockResolvedValueOnce({ data: preview })
      .mockResolvedValueOnce({ data: { added: 1, skipped: 2 } });

    await wrapper.get('[data-testid="import-check"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="import-commit"]').trigger("click");
    await flushPromises();
    expect(mocks.post.mock.calls[1][1]).toEqual({
      format: "json",
      content,
      proof: "checked-proof",
    });

    expect(wrapper.text()).toContain("Добавлено: 1");
    expect(wrapper.text()).toContain("Пропущено: 2");
    expect(wrapper.emitted("imported")).toHaveLength(1);
    wrapper.unmount();
  });

  it("при устаревшей проверке сохраняет текст и требует снова проверить", async () => {
    const wrapper = render();

    await wrapper.get("textarea").setValue(content);
    mocks.post.mockResolvedValueOnce({ data: preview }).mockRejectedValueOnce({
      response: { status: 409, data: { message: "Проверка устарела" } },
    });

    await wrapper.get('[data-testid="import-check"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="import-commit"]').trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[data-testid="import-commit"]').attributes("disabled")
    ).toBeDefined();

    expect(wrapper.get<HTMLTextAreaElement>("textarea").element.value).toBe(
      content
    );

    expect(wrapper.text()).toContain("Проверка устарела");
    wrapper.unmount();
  });
});
