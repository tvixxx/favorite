import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import UserSearchInput from "./UserSearchInput.vue";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/services/api", () => ({ default: api }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Выбор человека для заявки", () => {
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
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual([
      "Новый",
    ]);

    wrapper.unmount();
  });
});
