import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import CollectionFiltersBar from "./CollectionFiltersBar.vue";
import { WatchStatus } from "@/stores";

describe("Поиск в коллекции", () => {
  afterEach(() => vi.useRealTimers());

  it("не запускает отложенный поиск после закрытия страницы", async () => {
    vi.useFakeTimers();

    const searchHandler = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(CollectionFiltersBar, {
      props: { searchHandler },
      global: {
        stubs: {
          BaseIcon: true,
          FiltersSheet: true,
          FiltersActiveTags: true,
        },
      },
    });

    await wrapper.get("input").setValue("Светлячок");
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(350);
    expect(searchHandler).not.toHaveBeenCalled();
  });

  it("синхронизирует статус и поиск после внешнего сброса", async () => {
    const wrapper = mount(CollectionFiltersBar, {
      props: {
        searchHandler: vi.fn(),
        filters: { watchStatus: WatchStatus.COMPLETED },
        searchQuery: "Светлячок",
      },
      global: {
        stubs: { BaseIcon: true, FiltersSheet: true, FiltersActiveTags: true },
      },
    });

    expect(wrapper.get("input").element.value).toBe("Светлячок");
    expect(
      wrapper
        .findAll("button")
        .find((button) => button.text() === "Просмотрено")
        ?.attributes("aria-pressed")
    ).toBe("true");

    await wrapper.setProps({ filters: {}, searchQuery: "" });
    expect(wrapper.get("input").element.value).toBe("");
    expect(
      wrapper
        .findAll("button")
        .find((button) => button.text() === "Все")
        ?.attributes("aria-pressed")
    ).toBe("true");

    expect(wrapper.emitted("update:filters")).toBeUndefined();
    wrapper.unmount();
  });

  it("ищет последнюю строку через 350 мс, а Enter не дублирует отложенный запрос", async () => {
    vi.useFakeTimers();

    const searchHandler = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(CollectionFiltersBar, {
      props: { searchHandler },
      global: {
        stubs: { BaseIcon: true, FiltersSheet: true, FiltersActiveTags: true },
      },
    });

    await wrapper.get("input").setValue("Свет");
    await vi.advanceTimersByTimeAsync(200);
    await wrapper.get("input").setValue("  Светлячок  ");
    await vi.advanceTimersByTimeAsync(349);
    expect(searchHandler).not.toHaveBeenCalled();
    await wrapper.get("input").trigger("keydown.enter");
    await vi.advanceTimersByTimeAsync(350);
    expect(searchHandler).toHaveBeenCalledExactlyOnceWith("Светлячок");
    await wrapper.get("input").setValue("Дюна");
    await vi.advanceTimersByTimeAsync(350);
    expect(searchHandler).toHaveBeenLastCalledWith("Дюна");
    wrapper.unmount();
  });

  it("внешний сброс отменяет запрос набранной строки", async () => {
    vi.useFakeTimers();

    const searchHandler = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(CollectionFiltersBar, {
      props: { searchHandler, searchQuery: "Старый" },
      global: {
        stubs: { BaseIcon: true, FiltersSheet: true, FiltersActiveTags: true },
      },
    });

    await wrapper.get("input").setValue("Новый");
    await wrapper.setProps({ searchQuery: "" });
    await vi.advanceTimersByTimeAsync(350);
    expect(wrapper.get("input").element.value).toBe("");
    expect(searchHandler).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
