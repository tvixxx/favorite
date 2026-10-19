import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImagePicker from "./ImagePicker.vue";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  discard: vi.fn(),
  state: { sessionRevision: 0 },
}));

vi.mock("@/services/media", () => ({
  uploadImage: mocks.upload,
  discardImage: mocks.discard,
}));

vi.mock("@/state/state", () => ({ useMainStore: () => mocks.state }));

describe("Выбор изображения", () => {
  beforeEach(() => {
    mocks.upload.mockReset();
    mocks.discard.mockReset().mockResolvedValue(undefined);
    mocks.state = reactive({ sessionRevision: 0 });

    const NativeURL = URL;

    vi.stubGlobal(
      "URL",
      class extends NativeURL {
        static createObjectURL(file: File) {
          return `blob:fixture/${file.name}`;
        }
        static revokeObjectURL = vi.fn();
      }
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  const render = () =>
    mount(ImagePicker, {
      props: { modelValue: null, purpose: "MOVIE_POSTER" },
      global: { stubs: { BaseIcon: true } },
    });
  const select = async (wrapper: ReturnType<typeof render>, name: string) => {
    const input = wrapper.get('input[type="file"]');

    Object.defineProperty(input.element, "files", {
      configurable: true,
      value: [new File(["fixture"], name, { type: "image/png" })],
    });

    await input.trigger("change");
  };

  it("показывает обработанную картинку и передаёт идентификатор медиа", async () => {
    mocks.upload.mockResolvedValue({
      id: "asset-id",
      url: "https://media.example.test/full.webp",
      thumbnailUrl: "https://media.example.test/small.webp",
      width: 800,
      height: 1200,
      byteSize: 1024,
    });

    const wrapper = render();

    await select(wrapper, "poster.png");
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toMatchObject({
      assetId: "asset-id",
      url: "https://media.example.test/full.webp",
    });

    expect(wrapper.text()).toContain("800 × 1200");
    wrapper.unmount();
  });

  it("применяет введённую ссылку при выходе из поля перед сохранением формы", async () => {
    const wrapper = render();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "По ссылке")!
      .trigger("click");

    await wrapper
      .get('input[type="url"]')
      .setValue("https://images.example.test/poster.jpg");

    expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toEqual({
      url: "https://images.example.test/poster.jpg",
    });

    expect(mocks.upload).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("не возвращает старый постер после выбора нового файла", async () => {
    let finish!: (value: unknown) => void;

    mocks.upload.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    mocks.upload.mockResolvedValueOnce({
      id: "new",
      url: "https://media.example.test/new.webp",
    });

    const wrapper = render();

    await select(wrapper, "old.png");
    await select(wrapper, "new.png");
    await flushPromises();
    finish({ id: "old", url: "https://media.example.test/old.webp" });
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toMatchObject({
      assetId: "new",
    });

    wrapper.unmount();
  });

  it("отклоняет слишком большой файл до запроса", async () => {
    const wrapper = render();
    const input = wrapper.get('input[type="file"]');
    const file = new File(["fixture"], "large.png", { type: "image/png" });

    Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 });
    Object.defineProperty(input.element, "files", {
      configurable: true,
      value: [file],
    });

    await input.trigger("change");
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("10 МБ");
    wrapper.unmount();
  });

  it("сохраняет предыдущую загрузку, если замена не удалась", async () => {
    mocks.upload.mockResolvedValueOnce({
      id: "previous",
      url: "https://media.example.test/previous.webp",
    });

    mocks.upload.mockRejectedValueOnce(new Error("network"));

    const wrapper = render();

    await select(wrapper, "previous.png");
    await flushPromises();
    await select(wrapper, "replacement.png");
    await flushPromises();
    expect(mocks.discard).not.toHaveBeenCalled();
    expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toMatchObject({
      assetId: "previous",
    });

    wrapper.unmount();
  });

  it("удаляет предыдущую временную загрузку только после успешной замены", async () => {
    mocks.upload.mockResolvedValueOnce({
      id: "previous",
      url: "https://media.example.test/previous.webp",
    });

    mocks.upload.mockResolvedValueOnce({
      id: "next",
      url: "https://media.example.test/next.webp",
    });

    const wrapper = render();

    await select(wrapper, "previous.png");
    await flushPromises();
    await select(wrapper, "next.png");
    await flushPromises();
    expect(mocks.discard).toHaveBeenCalledWith("previous");
    expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toMatchObject({
      assetId: "next",
    });

    wrapper.unmount();
  });

  it("отменяет загрузку и освобождает blob при закрытии формы", async () => {
    mocks.upload.mockReturnValue(new Promise(() => {}));

    const wrapper = render();

    await select(wrapper, "poster.png");

    const options = mocks.upload.mock.calls[0][2];

    wrapper.unmount();
    expect(options.signal.aborted).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixture/poster.png");
  });
});
