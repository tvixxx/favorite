import { mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import ActorsPage from "./ActorsPage.vue";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock("@/stores", () => ({ useActorsStore: () => mocks.store }));

describe("Поиск на странице актёров", () => {
  afterEach(() => vi.useRealTimers());
  it("отменяет запрос после ухода со страницы", async () => {
    vi.useFakeTimers();
    const fetchActorsPage = vi.fn().mockResolvedValue(undefined);
    mocks.store = reactive({ actorsPageCurrent: 1, actorsPageSize: 20, actorsPageTotal: 0, actorsSearchQ: "", actorsPageItems: [], isActorsLoading: false, isActorsError: null, fetchActorsPage });
    const wrapper = mount(ActorsPage, { global: { stubs: { RouterLink: true, StateBlock: true, PosterGridSkeleton: true, "a-pagination": true } } });
    mocks.store.actorsSearchQ = "Идрис";
    await nextTick();
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(350);
    expect(fetchActorsPage).toHaveBeenCalledOnce();
  });
});
