import { mount } from "@vue/test-utils";
import Modal from "./BaseModal.vue";
import { nextTick } from "vue";

describe("BaseModal.vue", () => {
  let wrapper: any;

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
});
