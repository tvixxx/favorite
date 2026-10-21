import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CatalogMoviePreviewModal from "./CatalogMoviePreviewModal.vue";

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

const main = vi.hoisted(() => ({
  userData: null as null | { id: string; role: string },
}));

vi.mock("@/state/state", () => ({ useMainStore: () => main }));
vi.mock("@/stores", () => ({
  useMoviesStore: () => ({
    currentMovie: {
      id: "movie-1",
      createdById: "owner",
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
  it("предлагает смену постера автору и скрывает её для другого пользователя", async () => {
    for (const id of ["owner", "other"]) {
      main.userData = { id, role: "USER" };

      const wrapper = mount(CatalogMoviePreviewModal, {
        props: { modelValue: true, movieId: null },
        global: {
          stubs: {
            BaseModal: { template: '<section><slot name="body"/></section>' },
            MoviePosterEditor: true,
            ReportReviewModal: true,
            BaseIcon: true,
            "a-button": { template: "<button><slot/></button>" },
          },
        },
      });

      expect(wrapper.find(".catalog-preview__edit-poster").exists()).toBe(
        id === "owner"
      );

      if (id === "owner") {
        await wrapper.get(".catalog-preview__edit-poster").trigger("click");
        expect(
          wrapper.findComponent({ name: "MoviePosterEditor" }).exists()
        ).toBe(true);
      }

      wrapper.unmount();
    }

    main.userData = null;
  });

  it("не показывает текст до раскрытия читателем", async () => {
    const wrapper = mount(CatalogMoviePreviewModal, {
      props: { modelValue: true, movieId: null },
      global: {
        stubs: {
          BaseModal: { template: '<section><slot name="body"/></section>' },
          ReportReviewModal: true,
          BaseIcon: true,
          "a-button": { template: "<button><slot/></button>" },
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
