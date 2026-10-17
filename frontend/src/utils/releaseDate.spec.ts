import { describe, expect, it } from "vitest";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { releaseMonthBound, releaseDateInput } from "./releaseDate";
dayjs.extend(utc);
describe("Календарный месяц даты выхода", () => {
  it.each([-300, 240, 345])(
    "сохраняет все дни месяца при смещении %s минут",
    (offset) => {
      const selected = dayjs("2026-03-15").utcOffset(offset, true);
      expect(releaseMonthBound(selected, "from")).toBe(
        "2026-03-01T00:00:00.000Z"
      );
      expect(releaseMonthBound(selected, "to")).toBe(
        "2026-03-31T23:59:59.999Z"
      );
    }
  );
  it("не сдвигает день при повторном открытии календарного фильтра", () => {
    expect(
      releaseDateInput("2026-03-01T00:00:00.000Z").format("YYYY-MM-DD")
    ).toBe("2026-03-01");
  });
});
