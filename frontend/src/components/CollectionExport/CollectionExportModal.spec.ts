import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { Blob as NativeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CollectionExportModal from "./CollectionExportModal.vue";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  pdf: vi.fn(),
  print: vi.fn(),
  blobs: [] as Blob[],
  names: [] as string[],
}));
const main = reactive({
  userData: { id: "owner", timezone: "UTC" },
  sessionRevision: 0,
});
const collection = reactive({
  stats: { totalMovies: 23 },
  totalCount: 4,
  searchQuery: "Сериал",
  filters: { contentKind: "ANIME", watchStatus: "WATCHING" },
});

vi.mock("@/services/api", () => ({
  default: { get: mocks.get },
  getApiResponseMessage: () => "Выгрузка недоступна",
}));

vi.mock("@/state/state", () => ({ useMainStore: () => main }));
vi.mock("@/stores", () => ({ useUserMoviesStore: () => collection }));
vi.mock("@/services/collectionPdf", () => ({ createCollectionPdf: mocks.pdf }));

const payload = JSON.stringify({
  version: 2,
  movies: Array.from({ length: 23 }, (_, i) => ({ title: `Тайтл ${i}` })),
});
let wrapper: ReturnType<typeof mount>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blobs = [];
  mocks.names = [];
  main.userData.id = "owner";
  main.sessionRevision = 0;
  vi.stubGlobal("Blob", NativeBlob);
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        mocks.blobs.push(blob);

        return "blob:test";
      }),
      revokeObjectURL: vi.fn(),
    })
  );

  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    mocks.names.push(this.download);
  });

  mocks.get.mockResolvedValue({
    data: new Blob([payload], { type: "application/json" }),
    headers: {},
  });

  mocks.pdf.mockResolvedValue({
    blob: new Blob(["%PDF-test"], { type: "application/pdf" }),
    print: mocks.print,
    missingPosters: 0,
  });

  wrapper = mount(CollectionExportModal, {
    props: { modelValue: true },
    global: {
      stubs: {
        BaseModal: {
          template:
            '<section><slot name="title"/><slot name="body"/><slot name="footer"/></section>',
        },
        BaseIcon: true,
      },
    },
  });
});

afterEach(() => {
  wrapper.unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const click = async (text: string) => {
  await wrapper
    .findAll("button")
    .find((b) => (b.attributes("aria-label") ?? b.text()) === text)!
    .trigger("click");

  await flushPromises();
};

describe("Выгрузка коллекции", () => {
  it("объясняет пустую выборку и не скачивает пустой файл", async () => {
    mocks.get.mockResolvedValueOnce({ status: 204, data: "", headers: {} });
    await click("Скачать JSON");
    expect(wrapper.text()).toContain("В выбранной выборке нет тайтлов");
    expect(mocks.blobs).toHaveLength(0);
  });

  it("открывает PDF для печати отдельно от скачивания", async () => {
    const popup = {
      document: { title: "" },
      opener: null,
      close: vi.fn(),
    } as unknown as Window;

    vi.spyOn(window, "open").mockReturnValue(popup);
    await wrapper.get('input[value="pdf"]').setValue(true);
    mocks.get.mockResolvedValueOnce({
      data: {
        exportedAt: "2026-10-16T00:00:00Z",
        movies: [{ title: "Фильм" }],
      },
      headers: {},
    });

    await click("Открыть для печати");
    expect(mocks.print).toHaveBeenCalledWith(popup);
    expect(mocks.blobs).toHaveLength(0);
  });

  it("скачивает всю коллекцию, а не загруженную страницу или текущий поиск", async () => {
    await click("Скачать JSON");
    expect(JSON.parse(await mocks.blobs[0].text()).movies).toHaveLength(23);

    const query = new URL(mocks.get.mock.calls[0][0], "http://localhost")
      .searchParams;

    expect(query.get("scope")).toBe("all");
    expect(query.has("limit") || query.has("offset") || query.has("q")).toBe(
      false
    );

    expect(mocks.names[0]).toMatch(
      /^favorite-collection-\d{4}-\d{2}-\d{2}\.json$/
    );
  });

  it("передаёт поиск и новый вид контента только после выбора фильтрованной выгрузки", async () => {
    await wrapper.get('input[value="filtered"]').setValue(true);
    await wrapper.get('input[value="csv"]').setValue(true);
    mocks.get.mockResolvedValueOnce({
      data: new Blob(["CSV с данными"], { type: "text/csv" }),
      headers: {},
    });

    await click("Скачать CSV");

    const query = new URL(mocks.get.mock.calls[0][0], "http://localhost")
      .searchParams;

    expect(Object.fromEntries(query)).toMatchObject({
      scope: "filtered",
      q: "Сериал",
      contentKind: "ANIME",
      watchStatus: "WATCHING",
      format: "csv",
    });

    expect(await mocks.blobs[0].text()).toBe("CSV с данными");
  });

  it("не скачивает поздний ответ после закрытия или смены аккаунта", async () => {
    let finish!: (value: unknown) => void;

    mocks.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Скачать JSON")!
      .trigger("click");

    await wrapper.setProps({ modelValue: false });
    main.sessionRevision++;
    finish({ data: new Blob([payload]), headers: {} });
    await flushPromises();
    expect(mocks.blobs).toHaveLength(0);
  });

  it("позволяет повторить выгрузку после ошибки", async () => {
    mocks.get.mockRejectedValueOnce(new Error("failed"));
    await click("Скачать JSON");
    expect(wrapper.text()).toContain("Выгрузка недоступна");
    expect(mocks.blobs).toHaveLength(0);
    await click("Скачать JSON");
    expect(mocks.blobs).toHaveLength(1);
  });

  it("PDF по умолчанию выбирает просмотренное и скачивает готовый документ", async () => {
    await wrapper.get('input[value="pdf"]').setValue(true);
    mocks.get.mockResolvedValueOnce({
      data: {
        exportedAt: "2026-10-16T00:00:00Z",
        movies: [{ title: "Фильм" }],
      },
      headers: {},
    });

    await click("Скачать PDF");
    expect(
      new URL(mocks.get.mock.calls[0][0], "http://localhost").searchParams.get(
        "scope"
      )
    ).toBe("completed");

    expect(mocks.blobs[0].type).toBe("application/pdf");
    expect(mocks.names[0]).toMatch(/\.pdf$/);
    expect(mocks.print).not.toHaveBeenCalled();
  });
});
