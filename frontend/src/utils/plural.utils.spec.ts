import { describe, it, expect } from "vitest";
import { PLURAL, pluralize } from "@/utils/plural.utils";

describe("pluralize", () => {
  it("выбирает форму для единицы", () => {
    expect(pluralize(1, PLURAL.movie)).toBe("1 фильм");
    expect(pluralize(21, PLURAL.movie)).toBe("21 фильм");
  });

  it("выбирает форму для двух-четырёх", () => {
    expect(pluralize(2, PLURAL.movie)).toBe("2 фильма");
    expect(pluralize(34, PLURAL.movie)).toBe("34 фильма");
  });

  it("выбирает форму для пяти и больше", () => {
    expect(pluralize(5, PLURAL.movie)).toBe("5 фильмов");
    expect(pluralize(0, PLURAL.movie)).toBe("0 фильмов");
  });

  it("не путается на подростковых числах", () => {
    expect(pluralize(11, PLURAL.movie)).toBe("11 фильмов");
    expect(pluralize(112, PLURAL.movie)).toBe("112 фильмов");
    expect(pluralize(114, PLURAL.movie)).toBe("114 фильмов");
  });

  it("работает с другими словами", () => {
    expect(pluralize(1, PLURAL.season)).toBe("1 сезон");
    expect(pluralize(14, PLURAL.episode)).toBe("14 серий");
    expect(pluralize(2, PLURAL.episode)).toBe("2 серии");
  });
});
