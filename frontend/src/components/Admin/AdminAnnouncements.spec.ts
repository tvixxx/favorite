import { DOMWrapper, flushPromises, mount } from "@vue/test-utils";
import Antd from "ant-design-vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminAnnouncements from "./AdminAnnouncements.vue";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  default: { get: mocks.get, post: mocks.post, patch: mocks.patch },
}));

let wrapper: ReturnType<typeof mount>;

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))
  );

  mocks.get.mockResolvedValue({ data: { items: [], total: 0 } });
  mocks.post.mockResolvedValue({ data: {} });
});

afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function button(text: string): HTMLButtonElement {
  const result = [...document.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === text
  );

  if (!result) throw new Error("Не найдена кнопка " + text);

  return result;
}

async function setup() {
  wrapper = mount(AdminAnnouncements, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { BaseIcon: true } },
  });

  await flushPromises();
  button("Создать объявление").click();
  await flushPromises();
}

async function fill() {
  await new DOMWrapper(
    document.querySelector<HTMLInputElement>('input[maxlength="120"]')!
  ).setValue("Новая возможность");

  await new DOMWrapper(
    document.querySelector<HTMLTextAreaElement>("textarea")!
  ).setValue("Добавили историю уведомлений.");
}

describe("Черновик системного объявления", () => {
  it("оставляет один набор действий и сохраняет форму кнопкой из нижней панели", async () => {
    await setup();
    await fill();
    expect(
      [...document.querySelectorAll("button")].filter(
        (item) => item.textContent?.trim() === "Сохранить черновик"
      )
    ).toHaveLength(1);

    expect(
      [...document.querySelectorAll("button")].some(
        (item) => item.textContent?.trim() === "Сохранить"
      )
    ).toBe(false);

    button("Сохранить черновик").click();
    await flushPromises();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith("/admin/announcements", {
      title: "Новая возможность",
      body: "Добавили историю уведомлений.",
      category: "NEWS",
      actions: [],
    });
  });

  it("проверяет обязательные поля и не публикует ничего при предпросмотре", async () => {
    await setup();
    button("Сохранить черновик").click();
    await flushPromises();
    expect(mocks.post).not.toHaveBeenCalled();
    await fill();
    button("Предпросмотр").click();
    await flushPromises();
    expect(document.body.textContent).toContain("Предпросмотр объявления");
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
