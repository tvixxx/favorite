import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
} from "vue-router";
import router from "./index";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/services/api", () => ({ default: api }));
vi.mock("@/state/state", () => ({ useMainStore: vi.fn() }));

const feedbackRoute = router.options.routes.find(
  (route) => route.name === "feedback"
)!;

async function navigate(): Promise<string> {
  const testRouter = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        ...feedbackRoute,
        component: { template: "<div>Форма</div>" },
      } as RouteRecordRaw,
      {
        path: "/library/collection",
        component: { template: "<div>Медиатека</div>" },
      },
    ],
  });

  await testRouter.push("/feedback");

  return testRouter.currentRoute.value.path;
}

beforeEach(() => {
  api.get.mockReset();
});

afterAll(() => router.options.history.destroy());

describe("Доступ к форме обратной связи по прямой ссылке", () => {
  it.each([false, undefined, "true", 1])(
    "перенаправляет в медиатеку без явного разрешения сервера %s",
    async (feedback) => {
      api.get.mockResolvedValue({ data: { feedback } });

      expect(await navigate()).toBe("/library/collection");
    }
  );

  it("перенаправляет в медиатеку при недоступном сервере", async () => {
    api.get.mockRejectedValue(new Error("Сервер недоступен"));

    expect(await navigate()).toBe("/library/collection");
  });

  it("открывает форму после разрешения сервера", async () => {
    api.get.mockResolvedValue({ data: { feedback: true } });

    expect(await navigate()).toBe("/feedback");
  });
});
