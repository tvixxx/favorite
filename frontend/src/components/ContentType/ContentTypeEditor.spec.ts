import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ContentTypeEditor from "./ContentTypeEditor.vue";
import type { Movie } from "@/stores/movies/types";

const { patch } = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock("@/services/api", () => ({
  default: { patch },
  getApiResponseMessage: (error: {
    response?: { data?: { message?: string } };
  }) => error.response?.data?.message,
}));

function render() {
  return mount(ContentTypeEditor, {
    props: {
      modelValue: true,
      movie: {
        id: "old",
        title: "Сериал",
        isSerial: true,
        contentKind: null,
      } as Movie,
    },
    global: {
      stubs: {
        BaseModal: {
          template: '<div><slot name="body"/><slot name="footer"/></div>',
        },
        "a-button": {
          props: ["disabled"],
          template: '<button :disabled="disabled"><slot/></button>',
        },
      },
    },
  });
}

describe("Изменение типа своей карточки", () => {
  it("отменяет выбор без запроса и при повторном открытии показывает сохранённый тип", async () => {
    patch.mockReset();
    const wrapper = render();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Аниме")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Отмена")!
      .trigger("click");
    expect(patch).not.toHaveBeenCalled();
    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    expect(wrapper.text()).toContain("Сейчас: сериал");
    expect(
      wrapper
        .findAll("button")
        .find((button) => button.text() === "Аниме")!
        .attributes("aria-pressed")
    ).toBe("false");
    expect(
      wrapper
        .findAll("button")
        .find((button) => button.text() === "Сохранить")!
        .attributes("disabled")
    ).toBeDefined();
    expect(patch).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it("сохраняет ID и серийность при уточнении аниме", async () => {
    patch.mockReset().mockResolvedValue({ data: true });
    const wrapper = render();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Аниме")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Сохранить")!
      .trigger("click");
    await flushPromises();
    expect(patch).toHaveBeenCalledWith("/movies/old", {
      contentKind: "ANIME",
      isSerial: true,
    });
    expect(wrapper.emitted("saved")).toHaveLength(1);
    wrapper.unmount();
  });
  it("сохраняет выбор и показывает отказ при существующем прогрессе", async () => {
    patch
      .mockReset()
      .mockRejectedValue({
        response: {
          status: 409,
          data: { message: "У пользователей есть прогресс" },
        },
      });
    const wrapper = render();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Фильм")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Сохранить")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.emitted("saved")).toBeUndefined();
    expect(wrapper.get('[role="alert"]').text()).toContain("прогресс");
    expect(
      wrapper
        .findAll("button")
        .find((button) => button.text() === "Фильм")!
        .attributes("aria-pressed")
    ).toBe("true");
    wrapper.unmount();
  });
});
