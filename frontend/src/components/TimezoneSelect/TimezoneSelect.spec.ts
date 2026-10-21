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

  it("предлагает время устройства, но не меняет сохранённый пояс без нажатия", async () => {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const selected = device === "UTC" ? "Europe/Moscow" : "UTC";

    mocks.get.mockResolvedValue({ data: ["UTC", "Europe/Moscow"] });

    const wrapper = mount(TimezoneSelect, { props: { modelValue: selected } });

    await flushPromises();
    expect(wrapper.getComponent(Select).props("value")).toBe(selected);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();

    const button = wrapper
      .findAll("button")
      .find((item) => item.text().startsWith("Как на устройстве"))!;

    await button.trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[device]]);
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
