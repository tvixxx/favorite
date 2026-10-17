import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MoviePoster from "./MoviePoster.vue";
import { fallbackPosterSvg } from "@/utils/fallbackPoster";

describe("Обложка тайтла", () => {
  it("показывает загруженный постер, а после ошибки локальную обложку с безопасным названием", async () => {
    const wrapper = mount(MoviePoster, {
      props: {
        src: "https://example.test/real.jpg",
        seed: "movie-1",
        title: '<img src=x onerror="alert(1)">',
        meta: "2020 · Фильм",
      },
    });
    expect(wrapper.get("img").attributes("src")).toBe(
      "https://example.test/real.jpg"
    );
    await wrapper.get("img").trigger("error");
    expect(wrapper.get("img").attributes("src")).toMatch(
      /^data:image\/svg\+xml/
    );
    expect(wrapper.text()).toContain('<img src=x onerror="alert(1)">');
    expect(wrapper.findAll("img")).toHaveLength(1);
    await wrapper.setProps({ src: "https://example.test/new.jpg" });
    expect(wrapper.get("img").attributes("src")).toBe(
      "https://example.test/new.jpg"
    );
    wrapper.unmount();
  });

  it("сохраняет одну обложку для одной карточки при повторном открытии", () => {
    const props = {
      seed: "stable-card",
      title: "Длинное название",
      meta: "Сериал",
    };
    const first = mount(MoviePoster, { props });
    const src = first.get("img").attributes("src");
    first.unmount();
    const second = mount(MoviePoster, { props });
    expect(second.get("img").attributes("src")).toBe(src);
    expect(second.text()).toContain("Длинное название");
    second.unmount();
  });

  it("даёт разные рисунки и палитры без внешних ресурсов во всех темах", () => {
    const variants = new Set(
      Array.from({ length: 100 }, (_, i) =>
        fallbackPosterSvg(`card-${i}`, "light")
      )
    );
    expect(variants.size).toBeGreaterThanOrEqual(10);
    const themes = [
      "light",
      "dark",
      "emerald",
      "corporate",
      "synthwave",
      "retro",
      "cyberpunk",
    ];
    for (const theme of themes) {
      const svg = fallbackPosterSvg("one-card", theme);
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).not.toMatch(/<script|<image|href=|foreignObject/);
      expect(svg).toBe(fallbackPosterSvg("one-card", theme));
    }

    expect(
      new Set(themes.map((theme) => fallbackPosterSvg("one-card", theme))).size
    ).toBe(7);
  });
});
