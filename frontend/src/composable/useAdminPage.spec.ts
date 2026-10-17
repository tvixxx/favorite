import { effectScope } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminPage } from "./useAdminPage";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/services/api", () => ({ default: { get: mocks.get } }));

describe("Страницы административных списков", () => {
  beforeEach(() => mocks.get.mockReset());
  it("возвращается на существующую страницу после удаления последней записи", async () => {
    mocks.get.mockResolvedValueOnce({ data: { items: [], total: 20 } });
    mocks.get.mockResolvedValueOnce({
      data: { items: [{ id: "remaining" }], total: 20 },
    });
    const scope = effectScope();
    const state = scope.run(() =>
      useAdminPage<{ id: string }>("/admin/users")
    )!;

    await state.load(2);
    expect(state.page.value).toBe(1);
    expect(state.items.value).toEqual([{ id: "remaining" }]);
    expect(mocks.get).toHaveBeenLastCalledWith("/admin/users", {
      params: { limit: 20, offset: 0 },
    });
    scope.stop();
  });
  it("оставляет результат последнего запроса при обратном порядке ответов", async () => {
    let resolve!: (value: unknown) => void;
    mocks.get.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    mocks.get.mockResolvedValueOnce({
      data: { items: [{ id: "new" }], total: 50 },
    });
    const scope = effectScope();
    const state = scope.run(() =>
      useAdminPage<{ id: string }>("/admin/users")
    )!;
    const old = state.load(1);

    await state.load(2);
    resolve({ data: { items: [{ id: "old" }], total: 1 } });
    await old;
    expect(state.items.value).toEqual([{ id: "new" }]);
    expect(state.total.value).toBe(50);
    expect(state.page.value).toBe(2);
    scope.stop();
  });

  it("показывает ошибку без выдачи старой страницы за новую", async () => {
    mocks.get.mockResolvedValueOnce({
      data: { items: [{ id: "old" }], total: 50 },
    });
    mocks.get.mockRejectedValueOnce(new Error("Сеть"));
    const scope = effectScope();
    const state = scope.run(() =>
      useAdminPage<{ id: string }>("/admin/users")
    )!;

    await state.load();
    await state.load(2);
    expect(state.error.value).toBeTruthy();
    expect(state.page.value).toBe(1);
    expect(state.items.value).toEqual([{ id: "old" }]);
    scope.stop();
  });
});
