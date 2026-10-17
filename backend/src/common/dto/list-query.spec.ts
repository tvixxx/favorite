import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  UsersQueryDto,
  FeedbackQueryDto,
  createdAtRange,
} from './list-query.dto';

describe('Фильтры административных списков', () => {
  it('включает целиком выбранный день в часовом поясе панели', () => {
    expect(
      createdAtRange({ from: '2026-10-13', to: '2026-10-13' }, 'Europe/Samara'),
    ).toEqual({
      gte: new Date('2026-10-12T20:00:00Z'),
      lt: new Date('2026-10-13T20:00:00Z'),
    });
  });

  it('по умолчанию использует UTC, а для DST включает фактический календарный день', () => {
    expect(createdAtRange({ from: '2026-10-13', to: '2026-10-13' })).toEqual({
      gte: new Date('2026-10-13T00:00:00Z'),
      lt: new Date('2026-10-14T00:00:00Z'),
    });
    expect(
      createdAtRange({ from: '2024-03-31', to: '2024-03-31' }, 'Europe/Berlin'),
    ).toEqual({
      gte: new Date('2024-03-30T23:00:00Z'),
      lt: new Date('2024-03-31T22:00:00Z'),
    });
  });

  it('отклоняет обратный период', () => {
    expect(() =>
      createdAtRange({ from: '2026-10-14', to: '2026-10-13' }),
    ).toThrow();
  });

  it.each([
    { role: 'OWNER' },
    { state: 'deleted' },
    { from: '2026-02-31' },
    { limit: '101' },
    { offset: '-1' },
    { q: ['a', 'b'] },
    { sort: 'password' },
  ])('отклоняет некорректный фильтр %p', async (query) => {
    expect(
      await validate(plainToInstance(UsersQueryDto, query)),
    ).not.toHaveLength(0);
  });

  it('преобразует параметры страницы и сохраняет фильтры обращения', async () => {
    const query = plainToInstance(FeedbackQueryDto, {
      limit: '20',
      offset: '40',
      type: 'BUG',
      status: 'NEW',
      q: '  постер  ',
    });

    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({
      limit: 20,
      offset: 40,
      type: 'BUG',
      status: 'NEW',
      q: 'постер',
    });
  });
});
