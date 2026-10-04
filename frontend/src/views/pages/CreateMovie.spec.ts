import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CreateMovie from "./CreateMovie.vue";

const mocks = vi.hoisted(() => ({ create: vi.fn(), addPersonal: vi.fn(), fetch: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock("@/state/state", () => ({ useMainStore: () => ({ userData: { id: "user-id" } }) }));
vi.mock("@/stores/movies/moviesStore", () => ({ useMoviesStore: () => ({ createMovie: mocks.create }) }));
vi.mock("@/stores", async (original) => ({ ...(await original<Record<string, unknown>>()),
  useUserMoviesStore: () => ({ isLoaded: true, addUserMovie: mocks.addPersonal, fetchUserMovies: mocks.fetch }),
}));
vi.mock("@/stores/actors/actorsStore", () => ({ useActorsStore: () => ({ fetchActors: vi.fn(), getAllActors: [] }) }));
vi.mock("@/services/api", () => ({ getApiResponseMessage: vi.fn(), isApiConflictError: () => false }));

describe("Создание через форму", () => {
  it("передаёт личные параметры вместе с фильмом без второго запроса записи", async () => {
    mocks.create.mockResolvedValue({ id: "movie-id" });
    mocks.addPersonal.mockResolvedValue({});
    mocks.fetch.mockResolvedValue(undefined);
    const wrapper = mount(CreateMovie, { global: { stubs: {
      AppBackButton: true, BaseIcon: true, WatchStatusSelect: true,
      "a-form": { emits: ["finish"], methods: { resetFields: vi.fn() }, template: '<form @submit.prevent="$emit(\'finish\')"><slot/></form>' },
      "a-form-item": { template: "<div><slot/></div>" },
      "a-input": { props: ["value", "placeholder", "size"], emits: ["update:value"], template: '<input :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)"/>' },
      "a-textarea": { props: ["value"], emits: ["update:value"], template: '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)"/>' },
      "a-button": { template: "<button><slot/></button>" },
      "a-select": true, "a-select-option": true, "a-date-picker": true,
      "a-switch": true, "a-input-number": true, "a-rate": true,
    } } });
    await wrapper.get('input[placeholder="Например: Интерстеллар"]').setValue("Новый фильм");
    await wrapper.get("textarea").setValue("Описание фильма");
    await wrapper.get('button.cm-pill--more').trigger("click");
    await wrapper.findAll('button').find((button) => button.text() === "Научная фантастика")!.trigger("click");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      title: "Новый фильм", description: "Описание фильма", actorIds: [],
      genres: ["ACTION", "Sci_fi"],
      collection: { watchStatus: "NOT_STARTED", personalRate: null, seeLater: false },
    });
    expect(mocks.addPersonal).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
