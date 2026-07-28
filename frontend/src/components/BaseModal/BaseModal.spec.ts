import { mount } from "@vue/test-utils";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Modal from "./BaseModal.vue";
import { nextTick } from "vue";

describe("BaseModal", () => {
  let wrapper: ReturnType<typeof mount>;

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it("закрытие при клике на фон", async () => {
    wrapper = mount(Modal, {
      props: { modelValue: true },
      global: {
        stubs: {
          Transition: false,
          Teleport: false,
          BaseIcon: true,
          "a-button": true,
        },
      },
    });

    const backdrop = document.querySelector(".modal-backdrop");
    expect(backdrop).toBeTruthy();

    await (backdrop as Element).dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );

    await nextTick();

    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
  });

  describe("две открытые модалки", () => {
    const createModal = () =>
      mount(Modal, {
        props: { modelValue: false },
        global: { stubs: { BaseIcon: true, "a-button": true } },
      });

    const pressEscape = async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

      await nextTick();
    };

    it("Esc закрывает только верхнюю", async () => {
      const bottom = createModal();
      const top = createModal();

      await bottom.setProps({ modelValue: true });
      await top.setProps({ modelValue: true });
      await pressEscape();

      expect(top.emitted("update:modelValue")).toEqual([[false]]);
      expect(bottom.emitted("update:modelValue")).toBeUndefined();

      bottom.unmount();
      top.unmount();
    });

    it("после закрытия верхней Esc доходит до нижней", async () => {
      const bottom = createModal();
      const top = createModal();

      await bottom.setProps({ modelValue: true });
      await top.setProps({ modelValue: true });
      await top.setProps({ modelValue: false });
      await pressEscape();

      expect(bottom.emitted("update:modelValue")).toEqual([[false]]);

      bottom.unmount();
      top.unmount();
    });
  });
});
