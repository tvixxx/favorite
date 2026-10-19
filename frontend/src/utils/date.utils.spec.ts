import { describe, expect, it } from "vitest";
import {
  calendarDateKey,
  formatDate,
  formatDateTime,
  formatInstant,
  formatYear,
} from "./date.utils";

describe("Отображение дат", () => {
  it.each([formatDate, formatDateTime, formatYear])(
    "скрывает некорректную дату вместо Invalid Date",
    (formatter) => {
      expect(formatter("not-a-date")).toBe("не указано");
    }
  );

  it("использует русский месяц независимо от языка браузера", () => {
    expect(formatDate("2026-10-04T12:00:00Z")).toContain("октября");
  });

  it("применяет выбранный пояс к одному моменту времени, не сдвигая календарный год даты выхода", () => {
    const value = "2026-01-01T00:15:00Z";

    expect(calendarDateKey(value, "UTC")).toBe("2026-01-01");
    expect(calendarDateKey(value, "America/New_York")).toBe("2025-12-31");
    expect(
      formatInstant(value, "Asia/Kolkata", {
        hour: "2-digit",
        minute: "2-digit",
      })
    ).toBe("05:45");

    expect(formatYear("2026-01-01T00:00:00Z")).toBe("2026");
  });

  it("учитывает DST и использует безопасный UTC при повреждённой настройке", () => {
    expect(
      formatInstant("2024-03-31T00:30:00Z", "Europe/Berlin", {
        hour: "2-digit",
        minute: "2-digit",
      })
    ).toBe("01:30");

    expect(
      formatInstant("2024-03-31T01:30:00Z", "Europe/Berlin", {
        hour: "2-digit",
        minute: "2-digit",
      })
    ).toBe("03:30");

    expect(calendarDateKey("2026-01-01T00:15:00Z", "bad-zone")).toBe(
      "2026-01-01"
    );
  });
});
