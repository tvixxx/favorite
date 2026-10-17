import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import ProtectedImage from "./ProtectedImage.vue";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
}));
const store = reactive({ sessionRevision: 0 });
vi.mock("@/services/api", () => ({ default: { get: mocks.get } }));
vi.mock("@/state/state", () => ({ useMainStore: () => store }));
beforeEach(() => {
  vi.clearAllMocks();
  store.sessionRevision = 0;
  URL.createObjectURL = mocks.create.mockReturnValue("blob:qa-image");
  URL.revokeObjectURL = mocks.revoke;
});
describe("Закрытое изображение обращения", () => {
  it("загружает через API авторизации, показывает blob и освобождает его при смене сессии", async () => {
    mocks.get.mockResolvedValue({
      data: new Blob(["image"], { type: "image/webp" }),
    });
    const id = "11111111-1111-4111-8111-111111111111";
    const wrapper = mount(ProtectedImage, { props: { assetId: id } });
    await flushPromises();
    expect(mocks.get).toHaveBeenCalledWith(
      `/uploads/images/${id}/full.webp`,
      expect.objectContaining({ responseType: "blob" })
    );
    expect(wrapper.get("img").attributes("src")).toBe("blob:qa-image");
    mocks.get.mockRejectedValue(new Error("session ended"));
    store.sessionRevision++;
    await flushPromises();
    expect(mocks.revoke).toHaveBeenCalledWith("blob:qa-image");
    expect(wrapper.find("img").exists()).toBe(false);
    wrapper.unmount();
  });
  it("не отправляет токен на произвольный адрес и не показывает ответ после закрытия компонента", async () => {
    const invalid = mount(ProtectedImage, {
      props: { assetId: "https://attacker.example" },
    });
    await flushPromises();
    expect(mocks.get).not.toHaveBeenCalled();
    invalid.unmount();
    let finish!: (value: unknown) => void;
    mocks.get.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const wrapper = mount(ProtectedImage, {
      props: { assetId: "11111111-1111-4111-8111-111111111111" },
    });
    wrapper.unmount();
    finish({ data: new Blob(["image"], { type: "image/webp" }) });
    await flushPromises();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
