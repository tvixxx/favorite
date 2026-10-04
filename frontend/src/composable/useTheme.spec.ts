import { afterEach, describe, expect, it, vi } from "vitest";

describe("Восстановление темы", () => {
  afterEach(() => { localStorage.removeItem("app-theme"); vi.resetModules(); });

  it("восстанавливает допустимую тему вместо повреждённого значения", async () => {
    localStorage.setItem("app-theme", "removed-theme");
    vi.resetModules();
    const { themeConfig, currentTheme, themes } = await import("./useTheme");
    expect(themes).toContain(currentTheme.value);
    expect(themeConfig.value.token.colorPrimary).toBeTruthy();
  });
});
