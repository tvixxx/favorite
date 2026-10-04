import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import CollectionFiltersBar from "./CollectionFiltersBar.vue";
import { WatchStatus } from "@/stores";

describe("Поиск в коллекции", () => {
  afterEach(() => vi.useRealTimers());

  it("не запускает отложенный поиск после закрытия страницы", async () => {
    vi.useFakeTimers();
    const searchHandler = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(CollectionFiltersBar, { props: { searchHandler }, global: { stubs: {
      BaseIcon: true, FiltersSheet: true, FiltersActiveTags: true,
    } } });
    await wrapper.get("input").setValue("Светлячок");
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(350);
    expect(searchHandler).not.toHaveBeenCalled();
  });

  it("синхронизирует статус и поиск после внешнего сброса", async () => {
    const wrapper = mount(CollectionFiltersBar, { props: { searchHandler: vi.fn(), filters: { watchStatus: WatchStatus.COMPLETED }, searchQuery: "Светлячок" }, global: { stubs: { BaseIcon: true, FiltersSheet: true, FiltersActiveTags: true } } });
    expect(wrapper.get("input").element.value).toBe("Светлячок");
    expect(wrapper.findAll("button").find((button) => button.text() === "Просмотрено")?.attributes("aria-pressed")).toBe("true");
    await wrapper.setProps({ filters: {}, searchQuery: "" });
    expect(wrapper.get("input").element.value).toBe("");
    expect(wrapper.findAll("button").find((button) => button.text() === "Все")?.attributes("aria-pressed")).toBe("true");
    expect(wrapper.emitted("update:filters")).toBeUndefined();
    wrapper.unmount();
  });
});
