import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import MovieShareButton from "./MovieShareButton.vue";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ resolve: () => ({ href: "/detail/movie-id" }) }) }));
vi.mock("ant-design-vue", () => ({ message: mocks }));

describe("Копирование ссылки", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(document, "execCommand"); mocks.success.mockClear(); mocks.error.mockClear(); });
  it.each(["false", "throw"])("не показывает успех при отказе %s и убирает временное поле", async (failure) => {
    const copy = vi.fn(() => { if (failure === "throw") throw new Error("Denied");

      return false;
    });
    vi.stubGlobal("navigator", { clipboard: undefined });
    Object.defineProperty(document, "execCommand", { configurable: true, value: copy });
    const wrapper = mount(MovieShareButton, { props: { movieId: "movie-id", movieTitle: "Светлячок" }, global: { stubs: { BaseIcon: true } } });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledOnce();
    expect(document.querySelector("textarea")).toBeNull();
    wrapper.unmount();
  });
});
