import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MovieCard from "./MovieCard.vue";

describe("Доступность карточки фильма", () => {
  it("открывает фильм клавишами Enter и пробелом", async () => {
    const wrapper = mount(MovieCard, { props: { title: "Светлячок", posterSrc: "/poster.jpg" }, global: { stubs: { BaseIcon: true } } });
    expect(wrapper.get("article").attributes("tabindex")).toBe("0");
    await wrapper.get("article").trigger("keydown", { key: "Enter" });
    await wrapper.get("article").trigger("keydown", { key: " " });
    expect(wrapper.emitted("open")).toHaveLength(2);
  });

  it("действие избранного не открывает фильм и имеет корректную метку", async () => {
    const wrapper = mount(MovieCard, { props: { title: "Светлячок", posterSrc: "/poster.jpg", favorite: true }, global: { stubs: { BaseIcon: true } } });
    expect(wrapper.get("button").attributes("aria-label")).toBe("Убрать из избранного");
    await wrapper.get("button").trigger("keydown", { key: "Enter" });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("toggle-favorite")).toHaveLength(1);
    expect(wrapper.emitted("open")).toBeUndefined();
  });
});
