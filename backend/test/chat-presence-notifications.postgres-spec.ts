import { io, type Socket } from '../../frontend/node_modules/socket.io-client';
import { performanceFixture } from './performance-fixture';
import { setTimeout as delay } from 'node:timers/promises';

let fixture: Awaited<ReturnType<typeof performanceFixture>>;
let base: string;
const sockets: Socket[] = [];

function event(socket: Socket, name: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, receive);
      reject(new Error('Не получено событие ' + name));
    }, 5000);
    const receive = (value: unknown): void => {
      clearTimeout(timer);
      resolve(value);
    };
    socket.once(name, receive);
  });
}

async function connect(index: number) {
  const socket = io(base + '/chat', {
    autoConnect: false,
    auth: { token: fixture.tokens[index] },
    extraHeaders: { Origin: 'http://127.0.0.1:8096' },
    transports: ['websocket'],
  });
  sockets.push(socket);
  const snapshot = event(socket, 'presence:snapshot');
  socket.connect();
  return { socket, online: await snapshot };
}

async function mutate(
  index: number,
  path: string,
  method: string,
  body?: unknown,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + fixture.tokens[index],
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.status).toBeLessThan(300);
  return (await response.json()) as { id: string };
}

beforeAll(async () => {
  fixture = await performanceFixture();
  await fixture.app.listen(0, '127.0.0.1');
  base = await fixture.app.getUrl();
}, 30000);
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      (await fixture.db.prisma.userStatus.count({
        where: { isOnline: true },
      })) === 0
    )
      return;
    await delay(20);
  }
  expect(
    await fixture.db.prisma.userStatus.count({ where: { isOnline: true } }),
  ).toBe(0);
});

afterAll(async () => {
  for (const socket of sockets) socket.disconnect();
  await fixture?.close();
});

describe('Настоящие соединения чата и повторные заявки', () => {
  it('передаёт присутствие новому устройству, сохраняет его при закрытии одной вкладки и возвращает пропущенное сообщение', async () => {
    const alice = await connect(0);
    expect(alice.online).toEqual([]);
    const appeared = event(alice.socket, 'user:online');
    const bob = await connect(1);
    expect(bob.online).toContain(fixture.users[0]);
    expect(await appeared).toEqual({ userId: fixture.users[1] });
    const secondBob = await connect(1);
    expect(secondBob.online).toContain(fixture.users[0]);
    bob.socket.disconnect();
    alice.socket.disconnect();

    const saved = await new Promise<{ id: string }>((resolve, reject) => {
      secondBob.socket.timeout(5000).emit(
        'message:send',
        {
          receiverId: fixture.users[0],
          content: 'Сообщение во время отсутствия',
        },
        (error: Error | null, value: { id: string }) =>
          error ? reject(error) : resolve(value),
      );
    });
    expect(saved.id).toBeTruthy();
    expect(
      (
        await fixture.db.prisma.userStatus.findUnique({
          where: { userId: fixture.users[1] },
        })
      )?.isOnline,
    ).toBe(true);
    const returned = await connect(0);
    expect(returned.online).toContain(fixture.users[1]);
    const response = await fetch(
      `${base}/users/${fixture.users[0]}/messages/${fixture.users[1]}`,
      {
        headers: { Authorization: 'Bearer ' + fixture.tokens[0] },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: saved.id,
          content: 'Сообщение во время отсутствия',
        }),
      ]),
    );
  });

  it('доставляет отказ и повторную заявку вместе с событием обновления списка', async () => {
    const sender = await connect(0);
    const receiver = await connect(2);
    const firstNotice = event(receiver.socket, 'notification:new');
    const firstChange = event(receiver.socket, 'friendship:changed');
    const relation = await mutate(
      0,
      `/users/${fixture.users[0]}/friends/request`,
      'POST',
      { addresseeId: fixture.users[2], type: 'FRIEND_REQUEST' },
    );
    expect(await firstNotice).toMatchObject({ type: 'FRIEND_REQUEST' });
    await firstChange;
    const rejection = event(sender.socket, 'notification:new');
    await mutate(
      2,
      `/users/${fixture.users[2]}/friends/${relation.id}/reject`,
      'PATCH',
    );
    expect(await rejection).toMatchObject({ type: 'FRIEND_REJECTED' });
    expect(
      await fixture.db.prisma.notification.count({
        where: {
          userId: fixture.users[2],
          type: 'FRIEND_REQUEST',
          readAt: null,
        },
      }),
    ).toBe(0);
    const repeatedNotice = event(receiver.socket, 'notification:new');
    const repeatedChange = event(receiver.socket, 'friendship:changed');
    const repeated = await mutate(
      0,
      `/users/${fixture.users[0]}/friends/request`,
      'POST',
      { addresseeId: fixture.users[2], type: 'FRIEND_REQUEST' },
    );
    expect(repeated.id).toBe(relation.id);
    expect(await repeatedNotice).toMatchObject({ type: 'FRIEND_REQUEST' });
    await repeatedChange;
  });
});
