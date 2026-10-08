import {
  parseCountryFilters,
  parseCsvOrRepeated,
  parseGenreFilters,
} from './parse-query-filters';
import { MovieController } from '../../movie/movie.controller';
import MovieService from '../../movie/movie.service';
import { ActorController } from '../../actor/actor.controller';
import { ActorService } from '../../actor/actor.service';
import { MessageController } from '../../message/message.controller';
import { MessageService } from '../../message/message.service';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Параметры запросов до обращения к базе', () => {
  it('сохраняет CSV, повторные фильтры и прежний алиас Sci_fi', () => {
    expect(parseGenreFilters(['DRAMA,Sci_fi', 'ACTION'])).toEqual([
      'DRAMA',
      'Sci_fi',
      'ACTION',
    ]);
    expect(parseCountryFilters('us,gb')).toEqual(['US', 'GB']);
    expect(parseCsvOrRepeated(['a,b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it.each([
    () => parseGenreFilters('unknown'),
    () => parseCountryFilters('XX'),
    () => parseCsvOrRepeated({ a: 'b' } as never),
  ])('не превращает ошибочный фильтр в запрос всех записей', (parse) => {
    expect(parse).toThrow();
  });

  it('отклоняет повторный поисковый параметр и неверную дату', () => {
    const service = { search: jest.fn(), findAll: jest.fn() };
    const controller = new MovieController(service as unknown as MovieService);

    expect(() => controller.search(['a', 'b'] as never)).toThrow();
    expect(() => controller.findAll(undefined, undefined, 'invalid')).toThrow();
    expect(service.search).not.toHaveBeenCalled();
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('отклоняет повторный поиск актёра', () => {
    const service = { findMany: jest.fn() };
    const controller = new ActorController(service as unknown as ActorService);

    expect(() => controller.findAll(['a', 'b'] as never)).toThrow();
    expect(service.findMany).not.toHaveBeenCalled();
  });

  it.each(['-1', 'wat', '2.5', '100000000'])(
    'отклоняет небезопасный лимит истории %s',
    (limit) => {
      const controller = new MessageController({
        getMessages: jest.fn(),
      } as unknown as MessageService);

      return expect(
        controller.getMessages('u', 'p', { user: { id: 'u' } } as never, limit),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
});
