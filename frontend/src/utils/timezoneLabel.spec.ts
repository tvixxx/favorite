import { describe, expect, it } from "vitest";
import { timezoneLabel } from "./timezoneLabel";

describe("Понятное название часового пояса", () => {
  it("показывает город и смещение, включая Хабаровск и UTC", () => {
    const date = new Date("2026-01-15T12:00:00Z");

    expect(timezoneLabel("Europe/Moscow", date)).toBe("Москва (UTC+03:00)");
    expect(timezoneLabel("Europe/Samara", date)).toBe("Самара (UTC+04:00)");
    expect(timezoneLabel("Asia/Vladivostok", date)).toBe(
      "Владивосток, Хабаровск (UTC+10:00)"
    );

    expect(timezoneLabel("UTC", date)).toBe("UTC+00:00");
  });

  it("учитывает летнее время выбранной даты", () => {
    expect(timezoneLabel("Europe/Berlin", new Date("2026-01-15"))).toContain(
      "UTC+01:00"
    );

    expect(timezoneLabel("Europe/Berlin", new Date("2026-07-15"))).toContain(
      "UTC+02:00"
    );
  });

  it("не ломает профиль с неизвестным старым значением", () => {
    expect(timezoneLabel("Unknown/Zone")).toBe("Unknown/Zone");
  });
});
