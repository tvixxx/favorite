import { describe, expect, it } from "vitest";
import { numericDraftError, progressMax } from "./media-numbers";

describe("Граница прогресса при редактировании общего количества", () => {
  it("согласует количество цифр в ограничениях ввода", () => {
    expect(numericDraftError("12", { maxDigits: 1 })).toBe(
      "Введите число из 1 цифры"
    );

    expect(numericDraftError("1", { minDigits: 4 })).toBe(
      "Введите не меньше 4 цифр"
    );

    expect(numericDraftError("12", { minDigits: 21, maxDigits: 21 })).toBe(
      "Введите число из 21 цифры"
    );
  });

  it.each([undefined, null, Number.NaN, -1, 1.5])(
    "использует безопасную границу, пока общее количество %s не заполнено правильно",
    (value) => {
      expect(progressMax(value, 100)).toBe(100);
    }
  );

  it("сохраняет известный ноль, количество из источника и общий предел", () => {
    expect(progressMax(0, 5000)).toBe(0);
    expect(progressMax(59, 5000)).toBe(59);
    expect(progressMax(6000, 5000)).toBe(5000);
  });
});
