import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNavigateBack } from "./useNavigateBack";

const mocks = vi.hoisted(() => ({ router: {
  back: vi.fn(), push: vi.fn(), replace: vi.fn(),
} }));
vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));

describe("Возврат внутри приложения", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({ back: null, position: 10 }, "");
  });

  it("при прямой ссылке использует fallback вместо чужой истории браузера", async () => {
    await useNavigateBack().navigateBack({ fallback: "/library/collection" });
    expect(mocks.router.back).not.toHaveBeenCalled();
    expect(mocks.router.replace).toHaveBeenCalledWith("/library/collection");
  });

  it("возвращается по существующей истории Vue Router, даже с небольшой position", async () => {
    window.history.replaceState({ back: "/library/lists", position: 1 }, "");
    await useNavigateBack().navigateBack({ fallback: "/library/collection" });
    expect(mocks.router.back).toHaveBeenCalledOnce();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("не использует внешний URL в качестве предыдущего маршрута приложения", async () => {
    window.history.replaceState({ back: "https://example.test", position: 10 }, "");
    await useNavigateBack().navigateBack({ fallback: "/library/collection" });
    expect(mocks.router.replace).toHaveBeenCalledWith("/library/collection");
    expect(mocks.router.back).not.toHaveBeenCalled();
  });

  it("сохраняет явную навигацию push и запрет beforeNavigate", async () => {
    await useNavigateBack().navigateBack({ mode: "push", fallback: "/profile" });
    expect(mocks.router.push).toHaveBeenCalledWith("/profile");
    await useNavigateBack().navigateBack({ fallback: "/profile", beforeNavigate: () => false });
    expect(mocks.router.back).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});
