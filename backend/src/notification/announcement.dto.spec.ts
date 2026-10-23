import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AnnouncementDraftDto, ReleaseNoteDto } from './announcement.dto';

describe('Содержимое системных объявлений', () => {
  const draft = (actions: unknown = []) =>
    plainToInstance(AnnouncementDraftDto, {
      title: 'Новые уведомления',
      body: 'Добавили историю событий.\nИсправили поиск.',
      category: 'NEWS',
      actions,
    });
  const errors = async (dto: object) =>
    validate(dto, { whitelist: true, forbidNonWhitelisted: true });

  it('принимает обычный текст и кнопку на внутренний маршрут', async () => {
    expect(
      await errors(
        draft([{ label: 'Открыть историю', path: '/notifications' }]),
      ),
    ).toEqual([]);
  });

  it.each([
    '//example.test',
    'https://example.test',
    'javascript:alert(1)',
    '/%2f%2fevil.test',
    '/friends/../../admin',
    '/admin',
    '/auth/logout',
    '/notifications?redirect=https://example.test',
    '/chat/not-a-uuid',
  ])('отклоняет опасный или неподдерживаемый маршрут %s', async (path) => {
    expect(
      (await errors(draft([{ label: 'Открыть', path }]))).length,
    ).toBeGreaterThan(0);
  });

  it('не разрешает подменить получателя, публикацию или тип релиза через форму', async () => {
    const dto = Object.assign(draft(), {
      userId: 'other',
      publishedAt: new Date(),
      category: 'RELEASE',
    });
    expect((await errors(dto)).length).toBeGreaterThan(0);
  });

  it('отклоняет неизвестные поля действия и чрезмерное количество кнопок', async () => {
    expect(
      (await errors(draft([{ label: 'Открыть', path: '/', html: '<script>' }])))
        .length,
    ).toBeGreaterThan(0);
    expect(
      (
        await errors(
          draft(
            Array.from({ length: 3 }, () => ({ label: 'Открыть', path: '/' })),
          ),
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it('требует стабильный идентификатор релиза и принимает описание без кнопок', async () => {
    const dto = plainToInstance(ReleaseNoteDto, {
      id: '2026-10-notifications',
      title: 'Исправления',
      body: 'Повысили стабильность.',
      actions: [],
    });
    expect(await errors(dto)).toEqual([]);
    dto.id = '../notes';
    expect((await errors(dto)).length).toBeGreaterThan(0);
  });
});
