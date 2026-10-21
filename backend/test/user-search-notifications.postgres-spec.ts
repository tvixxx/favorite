import { Test } from '@nestjs/testing';
import {
  ValidationPipe,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import { featuresDatabase } from './features-database';
import { UserService } from '../src/user/user.service';
import { UserController } from '../src/user/user.controller';
import { NotificationService } from '../src/notification/notification.service';
import { NotificationController } from '../src/notification/notification.controller';
import { FriendshipService } from '../src/friendship/friendship.service';
import { FriendshipTypeDto } from '../src/friendship/dto';
import { JwtGuard } from '../src/common/guards';
import type { PrismaService } from '../src/prisma/prisma.service';

let db: Awaited<ReturnType<typeof featuresDatabase>>;
let app: INestApplication;
let owner: string;
let peer: string;
let third: string;
let base: string;
let friends: FriendshipService;
const deliver = jest.fn();

beforeAll(async () => {
  db = await featuresDatabase();
  const users = await Promise.all(
    ['owner', 'peer', 'third'].map((name) =>
      db.prisma.user.create({
        data: {
          email: `${name}@example.test`,
          fullName: name === 'owner' ? 'Владелец' : 'Александр',
          password: 'unused-test-hash',
        },
      }),
    ),
  );
  [owner, peer, third] = users.map((user) => user.id);
  const notifications = new NotificationService(db.prisma as PrismaService);
  friends = new FriendshipService(db.prisma as PrismaService, notifications, {
    emitToUser: deliver,
    emitFriendshipChanged: jest.fn(),
  } as never);
  const module = await Test.createTestingModule({
    controllers: [UserController, NotificationController],
    providers: [
      {
        provide: UserService,
        useValue: new UserService(db.prisma as PrismaService, {} as never),
      },
      { provide: NotificationService, useValue: notifications },
    ],
  })
    .overrideGuard(JwtGuard)
    .useValue({
      canActivate(context: ExecutionContext) {
        const req = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string>; user: unknown }>();
        req.user = { id: req.headers['x-test-user'], role: 'USER' };
        return true;
      },
    })
    .compile();
  app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
afterAll(async () => {
  await app?.close();
  await db?.close();
});

beforeEach(async () => {
  deliver.mockClear();
  await db.prisma.notification.deleteMany({});
  await db.prisma.friendship.deleteMany({});
  await db.prisma.user.updateMany({
    data: { username: null, blockedAt: null },
  });
  await db.prisma.user.update({
    where: { id: peer },
    data: { username: 'known_peer' },
  });
});

describe('Логины, поиск людей и история уведомлений', () => {
  it('сохраняет нормализованный логин и отклоняет занятый или недопустимый', async () => {
    await request(base)
      .patch(`/users/${peer}`)
      .set('x-test-user', peer)
      .send({ username: ' @Movie_Fan ' })
      .expect(200)
      .expect(({ body }: { body: { username: string } }) =>
        expect(body.username).toBe('movie_fan'),
      );
    await request(base)
      .patch(`/users/${third}`)
      .set('x-test-user', third)
      .send({ username: 'MOVIE_FAN' })
      .expect(409);
    await request(base)
      .patch(`/users/${third}`)
      .set('x-test-user', third)
      .send({ username: 'bad/name' })
      .expect(400);
    await request(base)
      .patch(`/users/${peer}`)
      .set('x-test-user', owner)
      .send({ username: 'changed' })
      .expect(403);
  });

  it('находит одинаковые имена и точный логин, не раскрывая почту найденных людей', async () => {
    const names = await request(base)
      .get('/users/search')
      .query({ query: 'Александр' })
      .set('x-test-user', owner)
      .expect(200);
    const namesBody = names.body as Array<
      Record<string, unknown> & { id: string }
    >;
    expect(namesBody.map((row) => row.id).sort()).toEqual([peer, third].sort());
    expect(
      namesBody.every(
        (row: Record<string, unknown>) =>
          !('email' in row) && !('password' in row),
      ),
    ).toBe(true);
    const login = await request(base)
      .get('/users/search')
      .query({ query: '@KNOWN_PEER' })
      .set('x-test-user', owner)
      .expect(200);
    expect(login.body).toEqual([
      expect.objectContaining({ id: peer, username: 'known_peer' }),
    ]);
  });

  it('требует точную почту и исключает заблокированного пользователя', async () => {
    const email = await request(base)
      .get('/users/search')
      .query({ query: 'peer@example.test' })
      .set('x-test-user', owner)
      .expect(200);
    expect(email.body).toEqual([expect.objectContaining({ id: peer })]);
    const partial = await request(base)
      .get('/users/search')
      .query({ query: 'peer@example' })
      .set('x-test-user', owner)
      .expect(200);
    expect(partial.body).toEqual([]);
    await db.prisma.user.update({
      where: { id: third },
      data: { blockedAt: new Date() },
    });
    const blocked = await request(base)
      .get('/users/search')
      .query({ query: 'third@example.test' })
      .set('x-test-user', owner)
      .expect(200);
    expect(blocked.body).toEqual([]);
    await request(base)
      .get('/users/search')
      .query({ query: 'а' })
      .set('x-test-user', owner)
      .expect(400);
  });

  it('выдаёт историю страницами и отдельно только непрочитанные для колокольчика', async () => {
    await db.prisma.notification.createMany({
      data: Array.from({ length: 27 }, (_, index) => ({
        userId: owner,
        type: 'FRIEND_REQUEST' as const,
        payload: { requesterName: `Друг ${index}` },
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        readAt: index % 2 ? new Date() : null,
      })),
    });
    const first = await request(base)
      .get(`/users/${owner}/notifications/page`)
      .query({ limit: 20, offset: 0 })
      .set('x-test-user', owner)
      .expect(200);
    const second = await request(base)
      .get(`/users/${owner}/notifications/page`)
      .query({ limit: 20, offset: 20 })
      .set('x-test-user', owner)
      .expect(200);
    type Notice = { id: string; readAt: string | null };
    const firstPage = first.body as { items: Notice[]; total: number };
    const secondPage = second.body as { items: Notice[]; total: number };
    expect(firstPage.total).toBe(27);
    expect(firstPage.items).toHaveLength(20);
    expect(secondPage.items).toHaveLength(7);
    const all = [...firstPage.items, ...secondPage.items];
    expect(new Set(all.map((row) => row.id)).size).toBe(27);
    const unread = await request(base)
      .get(`/users/${owner}/notifications`)
      .query({ limit: 5, unreadOnly: true })
      .set('x-test-user', owner)
      .expect(200);
    const unreadItems = unread.body as Notice[];
    expect(unreadItems).toHaveLength(5);
    expect(unreadItems.every((row) => row.readAt === null)).toBe(true);
    const id = unreadItems[0].id;
    await request(base)
      .patch(`/users/${owner}/notifications/${id}/read`)
      .set('x-test-user', owner)
      .expect(200);
    const after = await request(base)
      .get(`/users/${owner}/notifications`)
      .query({ limit: 5, unreadOnly: true })
      .set('x-test-user', owner)
      .expect(200);
    expect(after.body).toHaveLength(5);
    expect((after.body as Notice[]).some((row) => row.id === id)).toBe(false);
    await request(base)
      .get(`/users/${owner}/notifications/page`)
      .set('x-test-user', peer)
      .expect(403);
    await request(base)
      .get(`/users/${owner}/notifications/page`)
      .query({ offset: -1 })
      .set('x-test-user', owner)
      .expect(400);
  });

  it('сохраняет отказ и позволяет снова подать заявку с новым уведомлением', async () => {
    const first = await friends.sendRequest(owner, {
      addresseeId: peer,
      type: FriendshipTypeDto.FRIEND_REQUEST,
    });
    await friends.rejectRequest(peer, first.id);
    expect(
      await db.prisma.notification.count({
        where: { userId: peer, type: 'FRIEND_REQUEST', readAt: null },
      }),
    ).toBe(0);
    const rejected = await db.prisma.notification.findFirst({
      where: { userId: owner, type: 'FRIEND_REJECTED' },
    });
    expect(rejected?.payload).toMatchObject({
      friendshipId: first.id,
      friendId: peer,
    });
    expect(deliver).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({ type: 'FRIEND_REJECTED' }),
    );
    const repeated = await friends.sendRequest(owner, {
      addresseeId: peer,
      type: FriendshipTypeDto.FRIEND_REQUEST,
    });
    expect(repeated.id).toBe(first.id);
    expect((await friends.getRequests(peer)).map((row) => row.id)).toContain(
      first.id,
    );
    expect(
      await db.prisma.notification.count({
        where: { userId: peer, type: 'FRIEND_REQUEST' },
      }),
    ).toBe(2);
  });
});
