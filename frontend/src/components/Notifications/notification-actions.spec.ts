import { describe, expect, it } from "vitest";
import { safeNotificationActions } from "./notification-actions";

describe("Действия уведомлений", () => {
  it("оставляет разрешённый внутренний переход", () => {
    expect(
      safeNotificationActions([
        { label: "Мой дневник", path: "/library/diary" },
      ])
    ).toEqual([{ label: "Мой дневник", path: "/library/diary" }]);
  });

  it.each([
    "//evil.test",
    "javascript:alert(1)",
    "https://evil.test",
    "/admin",
    "/notifications?redirect=//evil.test",
    "/detail/../admin",
  ])("не передаёт опасный маршрут %s в навигацию", (path) => {
    expect(safeNotificationActions([{ label: "Открыть", path }])).toEqual([]);
  });

  it("не падает на повреждённых данных", () => {
    expect(
      safeNotificationActions([null, {}, { label: 42, path: "/" }])
    ).toEqual([]);

    expect(safeNotificationActions("<b>Ссылка</b>")).toEqual([]);
  });
});
