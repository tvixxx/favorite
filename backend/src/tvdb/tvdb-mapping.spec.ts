import { ContentKind, Genre } from '../generated/prisma/enums';
import { mapTvdbPreview } from './tvdb-mapping';

const record = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Original',
  year: '2020',
  originalCountry: 'jpn',
  genres: [{ name: 'Drama' }],
  characters: [],
  ...extra,
});
const locale = (name: string, overview: string) => ({ name, overview });

describe('Подготовка карточки TheTVDB', () => {
  it('ставит отмеченных актёров первыми по порядку источника и сохраняет лучшую роль при дубле', () => {
    const result = mapTvdbPreview(
      'movie',
      '1',
      record({
        characters: [
          { peopleId: 3, personName: 'Третий', peopleType: 'Actor', sort: 0 },
          {
            peopleId: 2,
            personName: 'Второй',
            peopleType: 'Actor',
            isFeatured: true,
            sort: 8,
          },
          {
            peopleId: 1,
            personName: 'Первый',
            peopleType: 'Actor',
            isFeatured: true,
            sort: 1,
          },
          {
            peopleId: 1,
            personName: 'Другая роль первого',
            peopleType: 'Actor',
            sort: 2,
          },
        ],
      }),
      null,
      null,
    );
    expect(result.actors).toEqual([
      { id: '1', name: 'Первый' },
      { id: '2', name: 'Второй' },
      { id: '3', name: 'Третий' },
    ]);
  });
  it('отделяет английское и оригинальное название и помечает английское описание', () => {
    const result = mapTvdbPreview(
      'movie',
      '1',
      record({ name: '日本語' }),
      null,
      locale('English title', '<p>English description</p>'),
    );
    expect(result).toMatchObject({
      title: '',
      titleEn: 'English title',
      originalTitle: '日本語',
      description: 'English description',
      descriptionLanguage: 'en',
      countryCodes: ['JP'],
    });
  });
  it('определяет аниме раньше анимации и не подменяет криминал детективом', () => {
    const result = mapTvdbPreview(
      'series',
      '1',
      record({
        genres: [
          { name: 'Animation' },
          { name: 'Anime' },
          { name: 'Crime' },
          { name: 'Drama' },
        ],
      }),
      locale('Аниме', 'Описание'),
      null,
    );
    expect(result).toMatchObject({
      contentKind: ContentKind.ANIME,
      isSerial: true,
      genres: [Genre.CRIME, Genre.DRAMA],
      unmappedGenres: [],
    });
  });
  it('оставляет жанры пустыми для неподдержанного справочника и не подставляет страну', () => {
    const result = mapTvdbPreview(
      'series',
      '1',
      record({
        originalCountry: null,
        genres: [{ name: 'Unknown source genre' }],
      }),
      locale('Шоу', 'Описание'),
      null,
    );
    expect(result).toMatchObject({
      contentKind: ContentKind.GENERAL,
      countryCodes: [],
      genres: [],
      unmappedGenres: ['Unknown source genre'],
    });
  });
  it('сохраняет только актёрский состав и исключает режиссёров и повторяющихся людей', () => {
    const result = mapTvdbPreview(
      'movie',
      '1',
      record({
        characters: [
          { peopleId: 1, personName: 'Актёр', peopleType: 'Actor' },
          { peopleId: 1, personName: 'Актёр', peopleType: 'Actor' },
          { peopleId: 2, personName: 'Режиссёр', peopleType: 'Director' },
        ],
      }),
      locale('Название', 'Описание'),
      null,
    );
    expect(result.actors).toEqual([{ id: '1', name: 'Актёр' }]);
  });
  it('не принимает чужой ID, некорректный формат и приватный адрес постера', () => {
    expect(() => mapTvdbPreview('movie', '2', record(), null, null)).toThrow();
    const result = mapTvdbPreview(
      'movie',
      '1',
      record({ image: 'http://127.0.0.1/private' }),
      locale('Название', 'Описание'),
      null,
    );
    expect(result.posterUrl).toBeNull();
  });
});
