import { ConflictException, NotFoundException } from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { FriendshipController } from './friendship.controller';
import { FriendshipTypeDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { MessageGateway } from '../message/message.gateway';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../message/message.gateway', () => ({ MessageGateway: class {} }));

describe('Дружба и безопасные ответы', () => {
  type Row = Record<string, unknown> & {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: string;
    type: string;
  };
  type Include = {
    include?: Record<string, true | { select: Record<string, boolean> }>;
  };
  let rows: Row[];
  let service: FriendshipService;
  const people = {
    first: {
      id: 'first',
      fullName: 'Первый',
      email: 'first@example.test',
      password: 'fixture-password-hash',
    },
    second: {
      id: 'second',
      fullName: 'Второй',
      email: 'second@example.test',
      password: 'fixture-password-hash',
    },
  };

  const project = (row: Row, query: Include) => {
    const result = { ...row };
    for (const [relation, id] of [
      ['requester', row.requesterId],
      ['addressee', row.addresseeId],
    ]) {
      const include = query.include?.[relation];
      if (!include) continue;
      const person = people[id as keyof typeof people];
      result[relation] =
        include === true
          ? { ...person }
          : Object.fromEntries(
              Object.keys(include.select)
                .filter((key) => include.select[key])
                .map((key) => [key, person[key as keyof typeof person]]),
            );
    }
    return result;
  };

  beforeEach(() => {
    rows = [];
    const prisma = {
      user: {
        findUnique: jest.fn(
          ({ where }: { where: { id: keyof typeof people } }) =>
            Promise.resolve(people[where.id]),
        ),
      },
      friendship: {
        findFirst: jest.fn(
          ({
            where,
          }: {
            where: {
              status?: string;
              type?: string;
              OR: Array<{ requesterId: string; addresseeId: string }>;
            };
          }) =>
            Promise.resolve(
              rows.find(
                (row) =>
                  (!where.status || row.status === where.status) &&
                  (!where.type || row.type === where.type) &&
                  where.OR.some(
                    (pair) =>
                      row.requesterId === pair.requesterId &&
                      row.addresseeId === pair.addresseeId,
                  ),
              ),
            ),
        ),
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(rows.find((row) => row.id === where.id)),
        ),
        create: jest.fn(
          (
            query: Include & {
              data: Pick<
                Row,
                'requesterId' | 'addresseeId' | 'status' | 'type'
              >;
            },
          ) => {
            const row = { id: 'relation-id', ...query.data };
            rows.push(row);
            return Promise.resolve(project(row, query));
          },
        ),
        update: jest.fn(
          (query: Include & { where: { id: string }; data: Partial<Row> }) => {
            const row = rows.find((item) => item.id === query.where.id);
            if (!row) throw new NotFoundException();
            Object.assign(row, query.data);
            return Promise.resolve(project(row, query));
          },
        ),
        delete: jest.fn(({ where }: { where: { id: string } }) => {
          const row = rows.find((item) => item.id === where.id);
          rows = rows.filter((item) => item.id !== where.id);
          return Promise.resolve(row);
        }),
      },
    };
    service = new FriendshipService(
      prisma as unknown as PrismaService,
      {
        create: jest.fn().mockResolvedValue({}),
        toDto: jest.fn(() => ({})),
      } as unknown as NotificationService,
      { emitToUser: jest.fn() } as unknown as MessageGateway,
    );
  });

  it('не возвращает хеши паролей при отправке запроса', async () => {
    const result = await service.sendRequest('first', {
      addresseeId: 'second',
      type: FriendshipTypeDto.FRIEND_REQUEST,
    });
    expect(result.requester).toEqual({
      id: 'first',
      fullName: 'Первый',
      email: 'first@example.test',
    });
    expect(result.addressee).not.toHaveProperty('password');
  });

  it('не возвращает хеши паролей при принятии запроса', async () => {
    rows.push({
      id: 'relation-id',
      requesterId: 'first',
      addresseeId: 'second',
      type: 'FRIEND_REQUEST',
      status: 'PENDING',
    });
    const result = await service.acceptRequest('second', 'relation-id');
    expect(result.status).toBe('ACCEPTED');
    expect(result.requester).not.toHaveProperty('password');
    expect(result.addressee).not.toHaveProperty('password');
  });

  it('позволяет заново отправить ранее отклонённый запрос', async () => {
    rows.push({
      id: 'relation-id',
      requesterId: 'first',
      addresseeId: 'second',
      type: 'FRIEND_REQUEST',
      status: 'REJECTED',
    });
    const result = await service.sendRequest('first', {
      addresseeId: 'second',
      type: FriendshipTypeDto.FRIEND_REQUEST,
    });
    expect(result.status).toBe('PENDING');
    expect(rows).toHaveLength(1);
  });

  it('не переводит принятую дружбу в отклонённый запрос', async () => {
    rows.push({
      id: 'relation-id',
      requesterId: 'first',
      addresseeId: 'second',
      type: 'FRIEND_REQUEST',
      status: 'ACCEPTED',
    });
    await expect(
      service.rejectRequest('second', 'relation-id'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(rows[0].status).toBe('ACCEPTED');
  });

  it('удаляет собственную связь через контроллер с правильными идентификаторами', async () => {
    rows.push({
      id: 'relation-id',
      requesterId: 'first',
      addresseeId: 'second',
      type: 'FRIEND_REQUEST',
      status: 'ACCEPTED',
    });
    const controller = new FriendshipController(service);
    await controller.removeFriendship('first', 'relation-id', {
      user: { id: 'first' },
    });
    expect(rows).toEqual([]);
  });

  it('разрешает подписаться на уже существующего друга', async () => {
    rows.push({
      id: 'friend-id',
      requesterId: 'first',
      addresseeId: 'second',
      type: 'FRIEND_REQUEST',
      status: 'ACCEPTED',
    });
    const result = await service.sendRequest('first', {
      addresseeId: 'second',
      type: FriendshipTypeDto.SUBSCRIPTION,
    });
    expect(result).toMatchObject({ type: 'SUBSCRIPTION', status: 'ACCEPTED' });
    expect(rows).toHaveLength(2);
  });

  it('разрешает запрос дружбы отдельно от подписки', async () => {
    rows.push({
      id: 'subscription-id',
      requesterId: 'first',
      addresseeId: 'second',
      type: 'SUBSCRIPTION',
      status: 'ACCEPTED',
    });
    const result = await service.sendRequest('first', {
      addresseeId: 'second',
      type: FriendshipTypeDto.FRIEND_REQUEST,
    });
    expect(result.status).toBe('PENDING');
    expect(rows).toHaveLength(2);
  });

  it('разрешает взаимные подписки', async () => {
    rows.push({
      id: 'reverse-id',
      requesterId: 'second',
      addresseeId: 'first',
      type: 'SUBSCRIPTION',
      status: 'ACCEPTED',
    });
    await service.sendRequest('first', {
      addresseeId: 'second',
      type: FriendshipTypeDto.SUBSCRIPTION,
    });
    expect(rows).toHaveLength(2);
  });

  it('не обходит блокировку при смене типа запроса', async () => {
    rows.push({
      id: 'blocked-id',
      requesterId: 'second',
      addresseeId: 'first',
      type: 'SUBSCRIPTION',
      status: 'BLOCKED',
    });
    await expect(
      service.sendRequest('first', {
        addresseeId: 'second',
        type: FriendshipTypeDto.FRIEND_REQUEST,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(rows).toHaveLength(1);
  });
});
