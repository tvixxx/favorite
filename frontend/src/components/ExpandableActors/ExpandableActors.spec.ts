import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ExpandableActors from "./ExpandableActors.vue";

const actors = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: `Актёр ${i + 1}`,
  }));

describe("Раскрываемый состав актёров", () => {
  it("раскрывает состав и сбрасывает раскрытие при смене произведения", async () => {
    const wrapper = mount(ExpandableActors, {
      props: { actors: actors(7), resetKey: "first", variant: "detail" },
      global: { stubs: { BaseIcon: true } },
    });

    expect(wrapper.findAll(".actor-card")).toHaveLength(6);
    expect(wrapper.get(".actors-toggle").attributes("aria-expanded")).toBe(
      "false"
    );

    await wrapper.get(".actors-toggle").trigger("click");
    expect(wrapper.findAll(".actor-card")).toHaveLength(7);
    await wrapper.setProps({ actors: actors(100), resetKey: "second" });
    expect(wrapper.findAll(".actor-card")).toHaveLength(6);
    await wrapper.get(".actors-toggle").trigger("click");
    expect(wrapper.findAll(".actor-card")).toHaveLength(100);
    await wrapper.get(".actors-toggle").trigger("click");
    expect(wrapper.findAll(".actor-card")).toHaveLength(6);
    await wrapper.setProps({ actors: actors(6), resetKey: "third" });
    expect(wrapper.find(".actors-toggle").exists()).toBe(false);
    expect(wrapper.findAll(".actor-card")).toHaveLength(6);
    wrapper.unmount();
  });

  it("в превью показывает весь состав на десктопе и сворачивает при повторном открытии", async () => {
    const wrapper = mount(ExpandableActors, {
      props: {
        actors: actors(15),
        resetKey: "movie:false",
        variant: "preview",
        collapsible: false,
      },
      global: { stubs: { BaseIcon: true } },
    });

    expect(wrapper.findAll(".catalog-preview__actor")).toHaveLength(15);
    expect(
      wrapper.find('[aria-controls="catalog-preview-actors"]').exists()
    ).toBe(false);

    await wrapper.setProps({ collapsible: true });
    expect(wrapper.findAll(".catalog-preview__actor")).toHaveLength(6);
    await wrapper
      .get('[aria-controls="catalog-preview-actors"]')
      .trigger("click");

    expect(wrapper.findAll(".catalog-preview__actor")).toHaveLength(15);
    await wrapper.setProps({ collapsible: false });
    await wrapper.setProps({ collapsible: true });
    expect(wrapper.findAll(".catalog-preview__actor")).toHaveLength(15);
    await wrapper.setProps({ resetKey: "movie:true" });
    expect(wrapper.findAll(".catalog-preview__actor")).toHaveLength(6);
    wrapper.unmount();
  });

  it("передаёт выбор актёра и показывает замену после ошибки фото", async () => {
    const cast = [
      {
        id: "a",
        name: "Анна Иванова",
        imageUrl: "https://images.example.test/actor.jpg",
      },
    ];
    const wrapper = mount(ExpandableActors, {
      props: { actors: cast, resetKey: "movie", variant: "detail" },
      global: { stubs: { BaseIcon: true } },
    });

    await wrapper.get(".actor-card").trigger("click");
    expect(wrapper.emitted("select")).toEqual([["a"]]);
    await wrapper.get("img").trigger("error");
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.get(".actor-card__initials").text()).toBe("АИ");
    await wrapper.setProps({ actors: [...cast] });
    expect(wrapper.find("img").exists()).toBe(true);
    wrapper.unmount();
  });
});
