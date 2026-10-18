import { afterAll, describe, expect, it } from "vitest";
import type { RouteLocationNormalized } from "vue-router";
import router from "./index";

const route = (path: string) => router.resolve(path) as RouteLocationNormalized;

afterAll(() => router.options.history.destroy());

describe("Прокрутка админки при изменении URL фильтра", () => {
  it("сохраняет позицию при поиске и смене страницы внутри текущей вкладки", async () => {
    expect(
      await router.options.scrollBehavior!(
        route("/admin?tab=users&users_q=qa&users_page=2"),
        route("/admin?tab=users"),
        null
      )
    ).toBe(false);
  });

  it("сохраняет восстановление позиции истории и переходы к якорям", async () => {
    expect(
      await router.options.scrollBehavior!(route("/admin"), route("/admin"), {
        top: 800,
        left: 0,
      })
    ).toEqual({ top: 800, left: 0 });

    expect(
      await router.options.scrollBehavior!(
        route("/admin#users"),
        route("/admin"),
        null
      )
    ).toEqual({ el: "#users", behavior: "smooth" });
  });

  it("возвращается наверх при переходе в другую вкладку или страницу", async () => {
    expect(
      await router.options.scrollBehavior!(
        route("/admin?tab=catalog"),
        route("/admin?tab=users"),
        null
      )
    ).toEqual({ top: 0, left: 0 });

    expect(
      await router.options.scrollBehavior!(
        route("/favorites"),
        route("/admin"),
        null
      )
    ).toEqual({ top: 0, left: 0 });
  });
});
