import { mapTvdbPreview } from './tvdb-mapping';

const sourceGenres = [
  ['Action', 'ACTION'],
  ['Adventure', 'ADVENTURE'],
  ['Awards Show', 'AWARDS_SHOW'],
  ['Children', 'CHILDREN'],
  ['Comedy', 'COMEDY'],
  ['Crime', 'CRIME'],
  ['Documentary', 'DOCUMENTARY'],
  ['Drama', 'DRAMA'],
  ['Family', 'FAMILY'],
  ['Fantasy', 'FANTASY'],
  ['Food', 'FOOD'],
  ['Game Show', 'GAME_SHOW'],
  ['History', 'HISTORY'],
  ['Home and Garden', 'HOME_AND_GARDEN'],
  ['Horror', 'HORROR'],
  ['Indie', 'INDIE'],
  ['Martial Arts', 'MARTIAL_ARTS'],
  ['Mini-Series', 'MINI_SERIES'],
  ['Musical', 'MUSICAL'],
  ['Mystery', 'DETECTIVE'],
  ['News', 'NEWS'],
  ['Podcast', 'PODCAST'],
  ['Reality', 'REALITY'],
  ['Romance', 'ROMANCE'],
  ['Science Fiction', 'Sci_fi'],
  ['Soap', 'SOAP'],
  ['Sport', 'SPORT'],
  ['Suspense', 'SUSPENSE'],
  ['Talk Show', 'TALK_SHOW'],
  ['Thriller', 'THRILLER'],
  ['Travel', 'TRAVEL'],
  ['War', 'WAR'],
  ['Western', 'WESTERN'],
];
describe('Жанры внешнего каталога', () => {
  it('сохраняет все текущие жанры справочника TheTVDB без потерь и повторов', () => {
    const result = mapTvdbPreview(
      'series',
      '1',
      {
        id: 1,
        genres: [
          ...sourceGenres.map(([name]) => ({ name })),
          { name: 'Adventure' },
          { name: 'Anime' },
          { name: 'Animation' },
        ],
      },
      { name: 'Тайтл', overview: 'Описание' },
      null,
    );
    expect([...result.genres].sort()).toEqual(
      sourceGenres.map(([, value]) => value).sort(),
    );
    expect(result.unmappedGenres).toEqual([]);
    expect(result.contentKind).toBe('ANIME');
  });
  it('не теряет предупреждение о новом неизвестном жанре источника', () => {
    const result = mapTvdbPreview(
      'movie',
      '1',
      { id: 1, genres: [{ name: 'New source genre' }, { name: 'Adventure' }] },
      null,
      null,
    );
    expect(result.genres).toEqual(['ADVENTURE']);
    expect(result.unmappedGenres).toEqual(['New source genre']);
  });
});
