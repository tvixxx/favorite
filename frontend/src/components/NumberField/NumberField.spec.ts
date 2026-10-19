import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
import NumberField from "./NumberField.vue";

function render(
  value?: number,
  options: {
    min?: number;
    max?: number;
    disabled?: boolean;
    controls?: boolean;
    minDigits?: number;
    maxDigits?: number;
  } = {}
) {
  const wrapper = mount(NumberField, {
    props: {
      label: "Просмотрено серий",
      min: 0,
      max: 59,
      modelValue: value,
      ...options,
      "onUpdate:modelValue": (value) => wrapper.setProps({ modelValue: value }),
    },
    global: { stubs: { BaseIcon: true } },
  });

  return wrapper;
}

describe("Числовое поле", () => {
  it("ограничивает длину нативного ввода, когда задан maxDigits", () => {
    const year = render(undefined, {
      controls: false,
      min: 1920,
      max: 2031,
      minDigits: 4,
      maxDigits: 4,
    });

    expect((year.get("input").element as HTMLInputElement).maxLength).toBe(4);

    const unlimited = render(3, { max: undefined });

    expect(unlimited.get("input").attributes("maxlength")).toBeUndefined();
    unlimited.unmount();
    year.unmount();
  });

  it.each([
    [100, "100999", "100"],
    [5000, "5000123", "5000"],
    [59, "5999", "59"],
    [3, "333", "3"],
    [0, "000", "0"],
  ])(
    "ограничивает ввод и вставку длиной максимума %s",
    async (max, pasted, expected) => {
      const wrapper = render(undefined, { max: Number(max) });

      expect((wrapper.get("input").element as HTMLInputElement).maxLength).toBe(
        String(max).length
      );

      await wrapper.get("input").setValue(String(pasted));
      expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
        expected
      );

      expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
        Number(expected),
      ]);

      await wrapper.get("input").setValue("");
      expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([undefined]);
      wrapper.unmount();
    }
  );

  it("меняет ограничение длины при изменении количества серий, сохраняя ошибку старого превышения", async () => {
    const wrapper = render(100, { max: 5000 });

    await wrapper.setProps({ max: 59 });
    expect((wrapper.get("input").element as HTMLInputElement).maxLength).toBe(
      2
    );

    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
      "100"
    );

    expect(
      (wrapper.get("input").element as HTMLInputElement).checkValidity()
    ).toBe(false);

    await wrapper.get("input").setValue("599");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("59");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([59]);
    wrapper.unmount();
  });

  it("ограничивает длинную вставку, но сохраняет проверку допустимого значения", async () => {
    const wrapper = render(3, { max: 5000 });

    await wrapper.get("input").setValue("100000");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
      "1000"
    );

    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([1000]);
    await wrapper.get("input").setValue("99999");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
      "9999"
    );

    expect(
      (wrapper.get("input").element as HTMLInputElement).checkValidity()
    ).toBe(false);

    expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBeNaN();
    wrapper.unmount();
  });

  it("ограничивает длинную вставку четырьмя символами и сохраняет возможность заменить год", async () => {
    const wrapper = render(1995, {
      controls: false,
      min: 1920,
      max: 2031,
      minDigits: 4,
      maxDigits: 4,
    });

    await wrapper.get("input").setValue("2031123456");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
      "2031"
    );

    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([2031]);
    await wrapper.get("input").setValue("2031999");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
      "2031"
    );

    await wrapper.get("input").setValue("1995");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([1995]);
    wrapper.unmount();
  });

  it.each(["003", "-1", "1.5", "2e3", "5001"])(
    "сохраняет неверный ввод %s без подмены и блокирует отправку",
    async (value) => {
      const wrapper = render(3, { max: 5000 });

      await wrapper.get("input").setValue(value);
      await wrapper.get("input").trigger("blur");
      expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
        value
      );

      expect(wrapper.get("input").attributes("aria-invalid")).toBe("true");
      expect(
        (wrapper.get("input").element as HTMLInputElement).checkValidity()
      ).toBe(false);

      expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBeNaN();
      await wrapper.get("input").setValue("4");
      expect(
        (wrapper.get("input").element as HTMLInputElement).checkValidity()
      ).toBe(true);

      expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([4]);
      wrapper.unmount();
    }
  );

  it("показывает ошибку неполного года после выхода и не заменяет его минимумом", async () => {
    const wrapper = render(undefined, {
      controls: false,
      min: 1920,
      max: 2031,
      minDigits: 4,
      maxDigits: 4,
    });

    await wrapper.get("input").setValue("199");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    await wrapper.get("input").trigger("blur");
    expect(wrapper.get('[role="alert"]').text()).toContain("4");

    const invalid = new Event("invalid", { cancelable: true });

    wrapper.get("input").element.dispatchEvent(invalid);
    expect(invalid.defaultPrevented).toBe(true);
    await wrapper.get("input").trigger("focus");
    expect(wrapper.get('[role="alert"]').text()).toContain("4");
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
      "199"
    );

    await wrapper.get("input").setValue("");
    expect(
      (wrapper.get("input").element as HTMLInputElement).checkValidity()
    ).toBe(true);

    wrapper.unmount();
  });

  it("позволяет вводить год без кнопок и не меняет его стрелкой клавиатуры", async () => {
    const wrapper = render(undefined, {
      controls: false,
      min: 1888,
      max: 2100,
    });

    expect(wrapper.findAll("button")).toHaveLength(0);
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("");
    await wrapper.get("input").setValue("1995");

    const event = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
    });

    Object.defineProperty(event, "which", { value: 38 });
    wrapper.get("input").element.dispatchEvent(event);
    await nextTick();
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([1995]);
    await wrapper.get("input").setValue("");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([undefined]);
    wrapper.unmount();
  });

  it("увеличивает и уменьшает число без отправки формы", async () => {
    const wrapper = render(7);

    await wrapper
      .get('button[aria-label="Увеличить: Просмотрено серий"]')
      .trigger("click");

    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("8");
    await wrapper
      .get('button[aria-label="Уменьшить: Просмотрено серий"]')
      .trigger("click");

    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("7");
    expect(
      wrapper
        .findAll("button")
        .every((button) => button.attributes("type") === "button")
    ).toBe(true);

    wrapper.unmount();
  });

  it("отличает пустое значение от нуля и начинает с разрешённого минимума", async () => {
    const wrapper = render(undefined, { min: 1 });

    expect(
      wrapper
        .get('button[aria-label="Уменьшить: Просмотрено серий"]')
        .attributes("disabled")
    ).toBeDefined();

    await wrapper
      .get('button[aria-label="Увеличить: Просмотрено серий"]')
      .trigger("click");

    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("1");
    await wrapper.get("input").setValue("");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([undefined]);

    const zero = render(0);

    expect((zero.get("input").element as HTMLInputElement).value).toBe("0");
    zero.unmount();
    wrapper.unmount();
  });

  it("отключает кнопки на границах и учитывает обновлённый максимум", async () => {
    const wrapper = render(0);

    expect(
      wrapper
        .get('button[aria-label="Уменьшить: Просмотрено серий"]')
        .attributes("disabled")
    ).toBeDefined();

    await wrapper.setProps({ modelValue: 59 });
    expect(
      wrapper
        .get('button[aria-label="Увеличить: Просмотрено серий"]')
        .attributes("disabled")
    ).toBeDefined();

    await wrapper.setProps({ max: 60 });
    await wrapper
      .get('button[aria-label="Увеличить: Просмотрено серий"]')
      .trigger("click");

    expect((wrapper.get("input").element as HTMLInputElement).value).toBe("60");
    wrapper.unmount();
  });

  it("позволяет вводить число и менять его стрелками клавиатуры", async () => {
    const wrapper = render(1);

    await wrapper.get("input").setValue("12");
    for (const [key, which, expected] of [
      ["ArrowUp", 38, 13],
      ["ArrowDown", 40, 12],
    ] as const) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true });

      Object.defineProperty(event, "which", { value: which });
      wrapper.get("input").element.dispatchEvent(event);
      await nextTick();
      expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([expected]);
    }

    wrapper.unmount();
  });

  it("блокирует ввод и обе кнопки во время сохранения", () => {
    const wrapper = render(3, { disabled: true });

    expect(wrapper.get("input").attributes("disabled")).toBeDefined();
    expect(wrapper.findAll("button")).toHaveLength(2);
    expect(
      wrapper
        .findAll("button")
        .every((button) => button.attributes("disabled") !== undefined)
    ).toBe(true);

    wrapper.unmount();
  });
});
