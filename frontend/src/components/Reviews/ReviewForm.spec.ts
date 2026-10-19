import { mount, flushPromises } from "@vue/test-utils";
import Antd from "ant-design-vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReviewForm from "./ReviewForm.vue";

beforeEach(() =>
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
);

afterEach(() => vi.unstubAllGlobals());

describe("Отметка спойлера в форме отзыва", () => {
  it("отправляет выбранную отметку вместе с текстом и оценкой", async () => {
    const wrapper = mount(ReviewForm, {
      props: { initialText: "Текст с раскрытием финала", initialRate: 8 },
      global: { plugins: [Antd], stubs: { BaseIcon: true } },
    });

    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.emitted("submit")).toEqual([
      ["Текст с раскрытием финала", 8, true],
    ]);

    wrapper.unmount();
  });

  it("подставляет отметку при редактировании и позволяет снять её", async () => {
    const wrapper = mount(ReviewForm, {
      props: {
        initialText: "Текст без раскрытия финала",
        initialRate: 8,
        initialIsSpoiler: true,
      },
      global: { plugins: [Antd], stubs: { BaseIcon: true } },
    });

    expect(
      (wrapper.get('input[type="checkbox"]').element as HTMLInputElement)
        .checked
    ).toBe(true);

    await wrapper.get('input[type="checkbox"]').setValue(false);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.emitted("submit")).toEqual([
      ["Текст без раскрытия финала", 8, false],
    ]);

    wrapper.unmount();
  });
});
