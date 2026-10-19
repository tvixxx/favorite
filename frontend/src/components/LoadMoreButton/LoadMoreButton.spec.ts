import { mount } from "@vue/test-utils";
import { Button } from "ant-design-vue";
import { describe, expect, it } from "vitest";
import LoadMoreButton from "./LoadMoreButton.vue";

describe("Кнопка догрузки", () => {
  it("показывает остаток и передаёт нажатие, обновляет подпись для повтора", async () => {
    const wrapper = mount(LoadMoreButton, {
      props: { count: 17 },
      global: { components: { AButton: Button } },
    });

    expect(wrapper.text()).toContain("Показать ещё");
    expect(wrapper.text()).toContain("17");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("loadMore")).toHaveLength(1);
    await wrapper.setProps({ count: 3, label: "Повторить загрузку" });
    expect(wrapper.text()).toContain("Повторить загрузку");
    expect(wrapper.text()).toContain("3");
    expect(wrapper.text()).not.toContain("17");
    wrapper.unmount();
  });

  it("во время загрузки не передаёт повторное нажатие", async () => {
    const wrapper = mount(LoadMoreButton, {
      props: { count: 2, loading: true },
      global: { components: { AButton: Button } },
    });

    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("loadMore")).toBeUndefined();
    await wrapper.setProps({ loading: false });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("loadMore")).toHaveLength(1);
    wrapper.unmount();
  });
});
