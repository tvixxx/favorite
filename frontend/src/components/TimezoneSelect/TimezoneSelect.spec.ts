import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Select } from "ant-design-vue";
import TimezoneSelect from "./TimezoneSelect.vue";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/services/api", () => ({ default: { get: mocks.get } }));
beforeEach(() => vi.clearAllMocks());
describe("Выбор часового пояса", () => {
  it("оставляет общий UTC по умолчанию и передаёт явный выбор пользователя", async () => {
    mocks.get.mockResolvedValue({ data: ["UTC", "Europe/Berlin"] });
    const wrapper = mount(TimezoneSelect);
    await flushPromises();
    const select = wrapper.getComponent(Select);
    expect(select.props("value")).toBe("UTC");
    select.vm.$emit("update:value", "Europe/Berlin");
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "Europe/Berlin",
    ]);
    wrapper.unmount();
  });
  it("сохраняет текущий выбор при ошибке списка и позволяет повторить", async () => {
    mocks.get
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: ["UTC", "Europe/Samara"] });
    const wrapper = mount(TimezoneSelect, {
      props: { modelValue: "Europe/Samara" },
    });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("Не удалось");
    expect(wrapper.getComponent(Select).props("value")).toBe("Europe/Samara");
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
