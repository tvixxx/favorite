import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TvdbAdd from "./TvdbAdd.vue";
const api = vi.hoisted(() => ({
  searchTvdb: vi.fn(),
  previewTvdb: vi.fn(),
  importTvdb: vi.fn(),
}));
vi.mock("@/services/tvdb", () => api);
vi.mock("@/services/api", () => ({ getApiResponseMessage: () => undefined }));
const candidate = {
  id: "247824",
  type: "series",
  title: "",
  titleEn: "The Voice",
  originalTitle: "The Voice",
  aliases: [],
  year: 2011,
  posterUrl: null,
  localMovieId: null,
  inCollection: false,
};
const preview = {
  ...candidate,
  title: "Голос США",
  description: "English description",
  descriptionLanguage: "en",
  contentKind: "TV_SHOW",
  isSerial: true,
  countryCodes: ["US"],
  genres: ["MUSICAL"],
  unmappedGenres: [],
  actors: [],
  seasonCount: null,
  episodeCount: null,
  localMatches: [],
};
function render(isAdmin = false) {
  return mount(TvdbAdd, {
    props: { userId: "owner", sessionRevision: 0, isAdmin },
    attachTo: document.body,
    global: {
      stubs: {
        MoviePoster: true,
        WatchStatusSelect: true,
        CountryFilter: true,
        RouterLink: { template: "<a><slot /></a>" },
      },
    },
  });
}

async function search(wrapper: ReturnType<typeof render>) {
  await wrapper
    .get('input[aria-label="Название для поиска"]')
    .setValue("The Voice");
  await wrapper.get('form[aria-label="Поиск TheTVDB"]').trigger("submit");
  await flushPromises();
}

beforeEach(() => {
  vi.resetAllMocks();
  api.searchTvdb.mockResolvedValue([candidate]);
  api.previewTvdb.mockResolvedValue(preview);
});
describe("Добавление из TheTVDB через интерфейс", () => {
  it('передаёт выбранный формат через общий селект', async () => {
    const wrapper = render();
    await wrapper.get('.ant-select-selector').trigger('mousedown'); await flushPromises();
    const films = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option')).find(option => option.textContent?.trim() === 'Фильмы');
    expect(films).toBeDefined();
    films!.click(); await flushPromises();
    await search(wrapper);
    expect(api.searchTvdb.mock.calls[0][1]).toBe('movie');
    expect(wrapper.find('select').exists()).toBe(false);
    wrapper.unmount();
  });
  it('не отправляет поиск с неверным годом вместо прежнего допустимого значения', async () => {
    const wrapper = render();
    await wrapper.get('input[aria-label="Название для поиска"]').setValue('Сериал');
    await wrapper.get('input[aria-label="Год, необязательно"]').setValue('1995');
    await wrapper.get('input[aria-label="Год, необязательно"]').setValue('003');
    await wrapper.get('form[aria-label="Поиск TheTVDB"]').trigger('submit');
    await flushPromises();
    expect(api.searchTvdb).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Укажите год из 4 цифр');
    wrapper.unmount();
  });
  it('меняет язык описания через общий селект и сохраняет выбранный язык', async () => {
    const wrapper = render(); await search(wrapper);
    await wrapper.get('button[data-tvdb-select]').trigger('click'); await flushPromises();
    expect(wrapper.find('select[aria-label="Язык описания"]').exists()).toBe(false);
    await wrapper.get('.ant-select-selector').trigger('mousedown'); await flushPromises();
    const russian = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option')).find(option => option.textContent?.trim() === 'Русский');
    expect(russian).toBeDefined();
    russian!.click(); await flushPromises();
    expect(wrapper.text()).toContain('Описание на русском');
    api.importTvdb.mockResolvedValueOnce({ movieId: 'saved', alreadyInCollection: false });
    await wrapper.get('form[aria-label="Подтверждение импорта"]').trigger('submit'); await flushPromises();
    expect(api.importTvdb.mock.calls[0][0].descriptionLanguage).toBe('ru');
    wrapper.unmount();
  });
  it('показывает подтверждение отдельной карточки только администратору', async () => {
    const wrapper = render(); await search(wrapper);
    await wrapper.get('button[data-tvdb-select]').trigger('click'); await flushPromises();
    expect(wrapper.text()).not.toContain('Совпадение названий · для администратора');
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
    await wrapper.setProps({ isAdmin: true });
    expect(wrapper.text()).toContain('Совпадение названий · для администратора');
    expect(wrapper.text()).toContain('Причина сохранится в журнале действий');
    wrapper.unmount();
  });
  it('использует общий выбор типа и не позволяет изменить формат источника', async () => {
    const wrapper = render(); await search(wrapper);
    await wrapper.get('button[data-tvdb-select]').trigger('click'); await flushPromises();
    const film = wrapper.findAll('[aria-label="Что добавляем"] button').find(button => button.text() === 'Фильм');
    expect(film).toBeDefined();
    expect(film!.attributes('disabled')).toBeDefined();
    const anime = wrapper.findAll('[aria-label="Что добавляем"] button').find(button => button.text() === 'Аниме')!;
    await anime.trigger('click');
    api.importTvdb.mockResolvedValueOnce({ movieId: 'saved', alreadyInCollection: false });
    await wrapper.get('form[aria-label="Подтверждение импорта"]').trigger('submit'); await flushPromises();
    expect(api.importTvdb.mock.calls[0][0]).toMatchObject({ type: 'series', contentKind: 'ANIME' });
    wrapper.unmount();
  });
  it('сначала выбирает 15 актёров, расширяет на 10 и переключает весь состав без потери выбора', async () => {
    api.previewTvdb.mockResolvedValueOnce({ ...preview, actors: Array.from({ length: 58 }, (_, i) => ({ id: String(i + 1), name: `Актёр ${i + 1}` })) });
    const wrapper = render(); await search(wrapper);
    await wrapper.get('button[data-tvdb-select]').trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('Актёры · 15 из 58');
    await wrapper.findAll('button').find(button => button.text() === 'Добавить ещё 10')!.trigger('click');
    expect(wrapper.text()).toContain('Актёры · 25 из 58');
    await wrapper.get('input[aria-label="Весь состав"]').setValue(true);
    expect(wrapper.text()).toContain('Актёры · 58 из 58');
    await wrapper.get('input[aria-label="Весь состав"]').setValue(false);
    expect(wrapper.text()).toContain('Актёры · 25 из 58');
    api.importTvdb.mockResolvedValueOnce({ movieId: 'saved', alreadyInCollection: false });
    await wrapper.get('form[aria-label="Подтверждение импорта"]').trigger('submit'); await flushPromises();
    expect(api.importTvdb.mock.calls[0][0].actorLimit).toBe(25);
    wrapper.unmount();
  });
  it('позволяет выбрать Приключения и передаёт этот жанр при подтверждении', async () => {
    api.importTvdb.mockResolvedValueOnce({ movieId: 'saved', alreadyInCollection: false });
    const wrapper = render(); await search(wrapper);
    await wrapper.get('button[data-tvdb-select]').trigger('click'); await flushPromises();
    const button = wrapper.findAll('button').find(item => item.text() === 'Приключения');
    expect(button).toBeDefined();
    await button!.trigger('click');
    await wrapper.get('form[aria-label="Подтверждение импорта"]').trigger('submit'); await flushPromises();
    expect(api.importTvdb.mock.calls[0][0].genres).toEqual(['MUSICAL', 'ADVENTURE']);
    wrapper.unmount();
  });
  it('позволяет очистить необязательный счётчик перед подтверждением', async () => {
    api.importTvdb.mockResolvedValueOnce({ movieId: 'saved', alreadyInCollection: false });
    const wrapper = render(); await search(wrapper);
    await wrapper.get('button[data-tvdb-select]').trigger('click'); await flushPromises();
    await wrapper.get('input[aria-label="Просмотрено серий — всего"]').setValue('5');
    await wrapper.get('input[aria-label="Просмотрено серий — всего"]').setValue('');
    await wrapper.get('form[aria-label="Подтверждение импорта"]').trigger('submit'); await flushPromises();
    expect(api.importTvdb).toHaveBeenCalledOnce();
    expect(api.importTvdb.mock.calls[0][0].collection.currentEpisode).toBeUndefined();
    wrapper.unmount();
  });
  it("не создаёт карточку при поиске и выборе, явно показывает язык и неизвестное число серий", async () => {
    const wrapper = render();
    await search(wrapper);
    await wrapper.get("button[data-tvdb-select]").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Описание на английском");
    expect(wrapper.text()).toContain("Количество серий неизвестно");
    expect(api.importTvdb).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it("после ошибки сохраняет правки и позволяет повторить подтверждение", async () => {
    api.importTvdb
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ movieId: "saved", alreadyInCollection: false });
    const wrapper = render();
    await search(wrapper);
    await wrapper.get("button[data-tvdb-select]").trigger("click");
    await flushPromises();
    await wrapper
      .get('input[aria-label="Название для русского интерфейса"]')
      .setValue("Голос Америки");
    await wrapper
      .get('form[aria-label="Подтверждение импорта"]')
      .trigger("submit");
    await flushPromises();
    expect(
      (
        wrapper.get('input[aria-label="Название для русского интерфейса"]')
          .element as HTMLInputElement
      ).value
    ).toBe("Голос Америки");
    await wrapper
      .get('form[aria-label="Подтверждение импорта"]')
      .trigger("submit");
    await flushPromises();
    expect(api.importTvdb.mock.calls[1][0]).toMatchObject({
      title: "Голос Америки",
      descriptionLanguage: "en",
      collection: { seeLater: true },
    });
    expect(wrapper.text()).toContain("Добавлено в коллекцию");
    wrapper.unmount();
  });
  it("игнорирует позднюю выдачу после смены сессии", async () => {
    let finish!: (data: unknown[]) => void;
    api.searchTvdb.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const wrapper = render();
    await search(wrapper);
    await wrapper.setProps({ userId: "other", sessionRevision: 1 });
    finish([candidate]);
    await flushPromises();
    expect(wrapper.find("button[data-tvdb-select]").exists()).toBe(false);
    expect(wrapper.emitted("added")).toBeUndefined();
    wrapper.unmount();
  });
});
