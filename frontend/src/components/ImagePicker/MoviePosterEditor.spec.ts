import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import MoviePosterEditor from "./MoviePosterEditor.vue";

const mocks = vi.hoisted(() => ({ patch: vi.fn() }));

vi.mock("@/services/api", () => ({ default: { patch: mocks.patch } }));
vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ant-design-vue")>()),
  message: { success: vi.fn(), error: vi.fn() },
}));

describe("Замена постера", () => {
  it("отправляет идентификатор файла без дублирования URL и обновляет постер после сохранения", async () => {
    mocks.patch.mockResolvedValue({ status: 200 });

    const wrapper = mount(MoviePosterEditor, {
      props: {
        modelValue: true,
        movie: {
          id: "movie-id",
          title: "Фильм",
          imageUrl: "https://example.test/old.jpg",
        } as never,
      },
      global: {
        stubs: {
          BaseModal: {
            template: '<div><slot name="body"/><slot name="footer"/></div>',
          },
          ImagePicker: true,
          "a-button": { template: "<button><slot/></button>" },
        },
      },
    });

    wrapper
      .getComponent({ name: "ImagePicker" })
      .vm.$emit("update:modelValue", {
        assetId: "asset-id",
        url: "https://media.example.test/full.webp",
        thumbnailUrl: "https://media.example.test/thumb.webp",
      });

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Сохранить")!
      .trigger("click");

    await flushPromises();
    expect(mocks.patch).toHaveBeenCalledWith("/movies/movie-id", {
      posterAssetId: "asset-id",
      imageUrl: undefined,
    });

    expect(wrapper.emitted("saved")?.[0]?.[0]).toMatchObject({
      assetId: "asset-id",
    });

    wrapper.unmount();
  });
});
