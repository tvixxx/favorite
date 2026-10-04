import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CreateMovie from "./CreateMovie.vue";

const mocks = vi.hoisted(() => ({ create: vi.fn(), addPersonal: vi.fn(), fetch: vi.fn(), addActor: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock("@/state/state", () => ({ useMainStore: () => ({ userData: { id: "user-id" } }) }));
vi.mock("@/stores/movies/moviesStore", () => ({ useMoviesStore: () => ({ createMovie: mocks.create }) }));
vi.mock("@/stores", async (original) => ({ ...(await original<Record<string, unknown>>()),
  useUserMoviesStore: () => ({ isLoaded: true, addUserMovie: mocks.addPersonal, fetchUserMovies: mocks.fetch }),
}));
vi.mock("@/stores/actors/actorsStore", () => ({ useActorsStore: () => ({ fetchActorsForPickers: vi.fn(), pickerActors: [], addActorByName: mocks.addActor }) }));
vi.mock("@/services/api", () => ({ getApiResponseMessage: vi.fn(), isApiConflictError: () => false }));

describe("Создание через форму", () => {
  it("передаёт личные параметры вместе с фильмом без второго запроса записи", async () => {
    mocks.create.mockResolvedValue({ id: "movie-id" });
    mocks.addPersonal.mockResolvedValue({});
    mocks.fetch.mockResolvedValue(undefined);
    const wrapper = render();
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

  it("не отправляет фильм пока новый актёр не получил ID", async () => {
    mocks.create.mockClear();
    let finish!: (actor: { id: string }) => void;
    mocks.addActor.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const wrapper = render();
    await wrapper.get('input[placeholder="Например: Интерстеллар"]').setValue("Новый фильм");
    await wrapper.get("textarea").setValue("Описание фильма");
    wrapper.getComponent({ name: "ASelect" }).vm.$emit("change", ["Новый актёр"]);
    await wrapper.get("form").trigger("submit");
    expect(mocks.create).not.toHaveBeenCalled();
    finish({ id: "00000000-0000-4000-8000-000000000000" });
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.create.mock.calls[0][0].actorIds).toEqual(["00000000-0000-4000-8000-000000000000"]);
    wrapper.unmount();
  });
});

function render() {
  return mount(CreateMovie, { global: { stubs: {
      AppBackButton: true, BaseIcon: true, WatchStatusSelect: true,
      "a-form": { emits: ["finish"], methods: { resetFields: vi.fn() }, template: '<form @submit.prevent="$emit(\'finish\')"><slot/></form>' },
      "a-form-item": { template: "<div><slot/></div>" },
      "a-input": { props: ["value", "placeholder", "size"], emits: ["update:value"], template: '<input :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)"/>' },
      "a-textarea": { props: ["value"], emits: ["update:value"], template: '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)"/>' },
      "a-button": { template: "<button><slot/></button>" },
      "a-select": true, "a-select-option": true, "a-date-picker": true,
      "a-switch": true, "a-input-number": true, "a-rate": true,
    } } });
}
