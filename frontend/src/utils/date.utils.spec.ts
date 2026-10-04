import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatYear } from "./date.utils";

describe("Отображение дат", () => {
  it.each([formatDate, formatDateTime, formatYear])("скрывает некорректную дату вместо Invalid Date", (formatter) => {
    expect(formatter("not-a-date")).toBe("не указано");
  });
  it("использует русский месяц независимо от языка браузера", () => {
    expect(formatDate("2026-10-04T12:00:00Z")).toContain("октября");
  });
});
