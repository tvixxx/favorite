import { parseReleaseNote } from './release-note';
describe('Файл описания релиза', () => {
  it('поддерживает отсутствие объявления и текст без кнопок', async () => {
    expect(await parseReleaseNote('null')).toBeNull();
    expect(
      await parseReleaseNote(
        JSON.stringify({
          id: '2026.10-center',
          title: 'Улучшения',
          body: 'Исправили поиск.',
        }),
      ),
    ).toMatchObject({ id: '2026.10-center', actions: [] });
  });
  it('не разрешает выполнить внешний переход или передать поля публикации', async () => {
    await expect(
      parseReleaseNote(
        JSON.stringify({
          id: 'release',
          title: 'Текст',
          body: 'Новость',
          actions: [{ label: 'Открыть', path: '//evil.test' }],
        }),
      ),
    ).rejects.toThrow('INVALID_RELEASE_NOTE');
    await expect(
      parseReleaseNote(
        JSON.stringify({
          id: 'release',
          title: 'Текст',
          body: 'Новость',
          publishedAt: 'now',
        }),
      ),
    ).rejects.toThrow('INVALID_RELEASE_NOTE');
  });
});
