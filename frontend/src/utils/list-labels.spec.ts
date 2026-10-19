import { describe, expect, it } from "vitest";
import { parseListLabels } from "./list-labels";

describe("Метки пользовательского списка", () => {
  it("убирает пробелы, пустые элементы и повторы с сохранением регистра и порядка", () => {
    expect(parseListLabels(" драма, , друзья,драма, Драма,друзья ")).toEqual([
      "драма",
      "друзья",
      "Драма",
    ]);
  });

  it("возвращает пустой список для пустого ввода", () => {
    expect(parseListLabels(" , , ")).toEqual([]);
  });
});
