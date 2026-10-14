import { parseCollectionFile } from './collection-file';

const movie = {
  title: 'Фильм, "пример"',
  isSerial: false,
  watchStatus: 'COMPLETED',
  personalRate: 8,
};
describe('Формат импорта коллекции', () => {
  it('одинаково читает JSON v1 и CSV с BOM, CRLF, запятыми и экранированными кавычками', () => {
    const json = parseCollectionFile(
      'json',
      JSON.stringify({ version: 1, movies: [movie] }),
    );
    const csv = parseCollectionFile(
      'csv',
      '\ufefftitle,isSerial,watchStatus,personalRate\r\n"Фильм, ""пример""",false,COMPLETED,8\r\n',
    );
    expect(csv).toEqual(json);
    expect(json[0]).toMatchObject({
      title: movie.title,
      isSerial: false,
      personalRate: 8,
      isFavorite: false,
      seeLater: false,
    });
  });
  it.each([
    { version: 2, movies: [movie] },
    { version: 1, movies: [{ ...movie, userId: 'someone' }] },
    { version: 1, movies: [{ ...movie, isSerial: 'false' }] },
    { version: 1, movies: [{ ...movie, personalRate: 11 }] },
    { version: 1, movies: [{ ...movie, title: '\n<script>text</script>' }] },
    { version: 1, movies: [{ ...movie, watchStatus: 'UNKNOWN' }] },
    { version: 1, movies: [] },
    { version: 1, movies: Array.from({ length: 201 }, () => movie) },
  ])('отклоняет неверную структуру и поля до работы с БД %#', (value) => {
    expect(() => parseCollectionFile('json', JSON.stringify(value))).toThrow();
  });
  it.each([
    'title,isSerial,watchStatus\n"Незакрыто,false,COMPLETED',
    'title,title,isSerial,watchStatus\nA,A,false,COMPLETED',
    'title,isSerial,watchStatus,role\nA,false,COMPLETED,ADMIN',
    'title,isSerial,watchStatus\nA,0,COMPLETED',
    'title,isSerial,watchStatus\nA,false,COMPLETED,extra',
    'title,isSerial,watchStatus\n"A"garbage,false,COMPLETED',
  ])(
    'отклоняет повреждённый CSV и не преобразует произвольные значения %s',
    (value) => {
      expect(() => parseCollectionFile('csv', value)).toThrow();
    },
  );
  it('отклоняет prototype keys и превышение размера в байтах', () => {
    expect(() =>
      parseCollectionFile(
        'json',
        '{"version":1,"movies":[{"title":"A","isSerial":false,"watchStatus":"COMPLETED","__proto__":{"role":"ADMIN"}}]}',
      ),
    ).toThrow();
    expect(() => parseCollectionFile('json', 'я'.repeat(20000))).toThrow();
    expect({}).not.toHaveProperty('role');
  });
});
