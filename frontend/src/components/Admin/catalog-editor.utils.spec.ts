import { describe, expect, it } from "vitest";
import { catalogPublishDate } from "./catalog-editor.utils";
describe("Редактирование даты тайтла", () => {
  it("сохраняет месяц, день и время при изменении других полей", () => {
    expect(catalogPublishDate(2026, "2026-10-05T09:16:53.222Z")).toBe(
      "2026-10-05T09:16:53.222Z"
    );
  });

  it("меняет год только по выбору пользователя и позволяет убрать дату", () => {
    expect(catalogPublishDate(2025, "2026-10-05T09:16:53.222Z")).toBe(
      "2025-01-01T00:00:00.000Z"
    );

    expect(catalogPublishDate(null, "2026-10-05T09:16:53.222Z")).toBeNull();
  });
});
