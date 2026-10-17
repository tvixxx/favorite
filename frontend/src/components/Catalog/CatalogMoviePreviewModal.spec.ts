import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CatalogMoviePreviewModal from "./CatalogMoviePreviewModal.vue";

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/state/state", () => ({ useMainStore: () => ({ userData: null }) }));
vi.mock("@/stores", () => ({
  useMoviesStore: () => ({
    currentMovie: {
      id: "movie-1",
      title: "Название",
      genres: [],
      actors: [],
      reviews: [
        {
          id: "review-1",
          text: "Развязка сюжета в предпросмотре",
          rate: 8,
          isSpoiler: true,
        },
      ],
    },
  }),
  useUserMoviesStore: () => ({ userMovies: [] }),
}));

describe("Спойлер в предпросмотре каталога", () => {
  it("не показывает текст до раскрытия читателем", async () => {
    const wrapper = mount(CatalogMoviePreviewModal, {
      props: { modelValue: true, movieId: null },
      global: {
        stubs: {
          BaseModal: { template: '<section><slot name="body"/></section>' },
          ReportReviewModal: true,
          BaseIcon: true,
          "a-dropdown": true,
        },
      },
    });
    expect(wrapper.text()).not.toContain("Развязка сюжета в предпросмотре");
    await wrapper.get('button[aria-expanded="false"]').trigger("click");
    expect(wrapper.text()).toContain("Развязка сюжета в предпросмотре");
    wrapper.unmount();
  });
});
