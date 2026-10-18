import {
  createPinia,
  disposePinia,
  getActivePinia,
  setActivePinia,
} from "pinia";
import { computed, nextTick, reactive } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MovieList from "./MovieList.vue";
import { useUserMoviesStore } from "@/stores/userMovies/userMoviesStore";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
const main = reactive({
  isLoggedIn: true,
  userData: {
    id: "user-id",
    quickAddEnabled: true,
    watchTonightEnabled: false,
  },
});

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/state/state", () => ({ useMainStore: () => main }));
vi.mock("@/composable", () => ({
  useFetch: mocks.fetch,
  useEscapeKey: vi.fn(),
  FETCH_METHOD: { get: "GET", post: "POST", delete: "DELETE" },
}));

vi.mock("@/constants", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDefaultLoaderDelayTime: () => 0,
}));

vi.mock("@/components/Skeleton/useMinLoading", () => ({
  useMinLoading: (get: () => boolean) => computed(get),
}));

vi.mock("@/services/api", () => ({
  getApiResponseMessage: vi.fn(),
  isApiConflictError: () => false,
}));

const row = (id: string) => ({
  id: `link-${id}`,
  userId: "user-id",
  movieId: id,
  isFavorite: false,
  seeLater: false,
  personalRate: null,
  watchStatus: "NOT_STARTED",
  addedAt: "2026-01-01",
  movie: {
    id,
    title: `Тайтл ${id}`,
    description: "",
    isSerial: false,
    countryCodes: [],
    genres: [],
    poster: null,
  },
});

describe("Загрузка коллекции после прямого открытия детали", () => {
  let wrapper: ReturnType<typeof mount>;

  beforeEach(() => {
    main.userData.quickAddEnabled = true;
    main.userData.watchTonightEnabled = false;
    vi.useFakeTimers();
    setActivePinia(createPinia());
    mocks.fetch.mockReset();
    mocks.fetch.mockImplementation(async (url: string) => ({
      status: 200,
      data: url.startsWith("/users/user-id/movies/page?")
        ? { items: [row("1"), row("2")], total: 2 }
        : row("1"),
    }));
  });

  afterEach(() => {
    wrapper?.unmount();
    disposePinia(getActivePinia()!);
    vi.useRealTimers();
  });

  it("показывает только включённые плавающие инструменты и убирает их без пустой панели", async () => {
    wrapper = mount(MovieList, {
      global: {
        stubs: {
          MovieCard: true,
          BaseIcon: true,
          PosterGridSkeleton: true,
          StateBlock: true,
          CollectionFiltersBar: true,
          WatchTonightModal: true,
          "a-auto-complete": true,
          "a-button": true,
          "a-input": true,
        },
      },
    });

    await flushPromises();
    expect(wrapper.find('[aria-label="Быстрый ввод"]').exists()).toBe(true);
    expect(
      wrapper.find('[aria-label="Что посмотреть сегодня?"]').exists()
    ).toBe(false);

    main.userData.quickAddEnabled = false;
    main.userData.watchTonightEnabled = true;
    await nextTick();
    expect(wrapper.find('[aria-label="Быстрый ввод"]').exists()).toBe(false);
    expect(
      wrapper.find('[aria-label="Что посмотреть сегодня?"]').exists()
    ).toBe(true);

    main.userData.watchTonightEnabled = false;
    await nextTick();
    expect(wrapper.find(".quick-add-fab").exists()).toBe(false);
  });

  it("показывает всю коллекцию, даже если кеш уже содержит одну детальную запись", async () => {
    const store = useUserMoviesStore();

    await store.fetchUserMovieById("user-id", "1");
    wrapper = mount(MovieList, {
      global: {
        stubs: {
          MovieCard: {
            props: ["title"],
            template: '<div class="test-movie">{{ title }}</div>',
          },
          BaseIcon: true,
          PosterGridSkeleton: true,
          StateBlock: true,
          CollectionFiltersBar: true,
          "a-auto-complete": true,
          "a-button": true,
          "a-input": true,
        },
      },
    });

    await flushPromises();
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(wrapper.findAll(".test-movie").map((card) => card.text())).toEqual([
      "Тайтл 1",
      "Тайтл 2",
    ]);
  });

  it("после смены фильтров загружает общий список вместо старой выборки", async () => {
    const store = useUserMoviesStore();

    store.setFilters({ watchStatus: "COMPLETED" } as never);
    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: { items: [row("1")], total: 1 },
    });

    await store.fetchUserMovies("user-id");
    store.setFilters({});
    wrapper = mount(MovieList, {
      global: {
        stubs: {
          MovieCard: {
            props: ["title"],
            template: '<div class="test-movie">{{ title }}</div>',
          },
          BaseIcon: true,
          PosterGridSkeleton: true,
          StateBlock: true,
          CollectionFiltersBar: true,
          "a-auto-complete": true,
          "a-button": true,
          "a-input": true,
        },
      },
    });

    await flushPromises();
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(wrapper.findAll(".test-movie")).toHaveLength(2);
  });

  it("предупреждает о списках и удаляет только после подтверждения", async () => {
    wrapper = mount(MovieList, {
      global: {
        stubs: {
          MovieCard: {
            props: ["title"],
            emits: ["delete"],
            template:
              '<div class="test-movie"><span>{{ title }}</span><button data-test="remove" @click="$emit(\'delete\')">Удалить</button></div>',
          },
          BaseModal: {
            props: ["modelValue"],
            template:
              '<section v-if="modelValue" role="dialog"><slot name="body"/><slot name="footer"/></section>',
          },
          BaseIcon: true,
          AppSpinner: {
            props: ["size", "onDark"],
            template: '<span role="status"/>',
          },
          PosterGridSkeleton: true,
          StateBlock: true,
          CollectionFiltersBar: true,
          "a-auto-complete": true,
          "a-button": true,
          "a-input": true,
        },
      },
    });

    await flushPromises();
    await vi.runAllTimersAsync();
    await wrapper.findAll('[data-test="remove"]')[0].trigger("click");

    const deletions = () =>
      mocks.fetch.mock.calls.filter(
        ([, options]) => options?.method === "DELETE"
      );

    expect(deletions()).toHaveLength(0);
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "из всех ваших списков"
    );

    await wrapper.get(".confirm-dialog__btn--ghost").trigger("click");
    expect(deletions()).toHaveLength(0);
    await wrapper.findAll('[data-test="remove"]')[0].trigger("click");
    await wrapper.get(".confirm-dialog__btn--danger").trigger("click");
    await flushPromises();
    expect(deletions()).toHaveLength(1);
    expect(
      wrapper.findAll(".test-movie span").map((card) => card.text())
    ).toEqual(["Тайтл 2"]);
  });

  it("помечает подсказку как уже добавленную вне загруженной страницы", async () => {
    mocks.fetch.mockImplementation(async (url: string) => ({
      status: 200,
      data: url.startsWith("/movies/suggestions?")
        ? [
            {
              id: "unloaded",
              title: "Фильм",
              isSerial: false,
              publishDate: null,
              inCollection: true,
            },
          ]
        : { items: [row("1")], total: 40 },
    }));

    wrapper = mount(MovieList, {
      global: {
        stubs: {
          MovieCard: true,
          BaseIcon: true,
          PosterGridSkeleton: true,
          StateBlock: true,
          CollectionFiltersBar: true,
          "a-auto-complete": {
            name: "AutoCompleteStub",
            props: ["options"],
            emits: ["search"],
            template: "<div/>",
          },
          "a-button": true,
          "a-input": true,
        },
      },
    });

    await flushPromises();
    await wrapper.get(".quick-add-fab__button").trigger("click");

    const autocomplete = wrapper.findComponent({ name: "AutoCompleteStub" });

    autocomplete.vm.$emit("search", "Фильм");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(autocomplete.props("options")).toEqual([
      {
        value: "unloaded",
        label: "Фильм • фильм • год не указан • уже в коллекции",
        disabled: true,
      },
    ]);

    expect(
      mocks.fetch.mock.calls.some(
        ([url]) =>
          url.includes("/movies/suggestions?q=") && url.endsWith("&limit=10")
      )
    ).toBe(true);

    autocomplete.vm.$emit("search", "Новый запрос");
    await nextTick();
    expect(autocomplete.props("options")).toEqual([]);
  });

  it("не заменяет новые подсказки поздним ответом старого поиска", async () => {
    let finish!: (value: unknown) => void;

    mocks.fetch.mockImplementation((url: string) => {
      if (url.startsWith("/movies/suggestions?q=old"))
        return new Promise((resolve) => {
          finish = resolve;
        });
      if (url.startsWith("/movies/suggestions?"))
        return Promise.resolve({
          status: 200,
          data: [
            {
              id: "new",
              title: "New",
              isSerial: false,
              publishDate: null,
              inCollection: false,
            },
          ],
        });

      return Promise.resolve({ status: 200, data: { items: [], total: 0 } });
    });

    wrapper = mount(MovieList, {
      global: {
        stubs: {
          MovieCard: true,
          BaseIcon: true,
          PosterGridSkeleton: true,
          StateBlock: true,
          CollectionFiltersBar: true,
          "a-auto-complete": {
            name: "AutoCompleteStub",
            props: ["options"],
            emits: ["search"],
            template: "<div/>",
          },
          "a-button": true,
          "a-input": true,
        },
      },
    });

    await flushPromises();
    await wrapper.get(".quick-add-fab__button").trigger("click");

    const autocomplete = wrapper.findComponent({ name: "AutoCompleteStub" });

    autocomplete.vm.$emit("search", "old");
    await vi.advanceTimersByTimeAsync(300);
    autocomplete.vm.$emit("search", "new");
    await vi.advanceTimersByTimeAsync(300);
    finish({
      status: 200,
      data: [{ id: "old", title: "Old", inCollection: false }],
    });

    await flushPromises();
    expect(
      autocomplete.props("options").map((item: { value: string }) => item.value)
    ).toEqual(["new"]);
  });

  it("не закрывает Quick Add на mousedown по вынесенной подсказке и отправляет добавление", async () => {
    mocks.fetch.mockImplementation(
      async (url: string, options?: { method?: string }) => {
        if (options?.method === "POST")
          return { status: 201, data: row("new") };
        if (url.startsWith("/movies/suggestions?"))
          return {
            status: 200,
            data: [{ id: "new", title: "Новый", inCollection: false }],
          };

        return { status: 200, data: { items: [row("1")], total: 1 } };
      }
    );

    wrapper = mount(MovieList, {
      attachTo: document.body,
      global: {
        stubs: {
          MovieCard: true,
          BaseIcon: true,
          PosterGridSkeleton: true,
          StateBlock: true,
          CollectionFiltersBar: true,
          "a-auto-complete": {
            name: "AutoCompleteStub",
            props: ["options", "getPopupContainer"],
            emits: ["search", "select"],
            template: `<div ref="trigger"><Teleport v-if="options.length" :to="getPopupContainer ? getPopupContainer($refs.trigger) : 'body'"><button data-test="quick-add-option" @click="$emit('select',options[0].value)">{{options[0].label}}</button></Teleport></div>`,
          },
          "a-button": true,
          "a-input": true,
        },
      },
    });

    await flushPromises();
    await wrapper.get(".quick-add-fab__button").trigger("click");
    wrapper
      .findComponent({ name: "AutoCompleteStub" })
      .vm.$emit("search", "Новый");

    await vi.advanceTimersByTimeAsync(300);

    const option = document.querySelector<HTMLButtonElement>(
      '[data-test="quick-add-option"]'
    );

    expect(option).not.toBeNull();
    if (!option) throw new Error("Нет подсказки");
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await nextTick();
    expect(option.isConnected).toBe(true);
    option.click();
    await flushPromises();
    expect(
      mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")
    ).toHaveLength(1);
  });
});
