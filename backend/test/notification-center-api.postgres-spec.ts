import { performanceFixture } from './performance-fixture';
import { MessageService } from '../src/message/message.service';
import { io, type Socket } from '../../frontend/node_modules/socket.io-client';

let fixture: Awaited<ReturnType<typeof performanceFixture>>;
let base: string;
const sockets: Socket[] = [];
beforeAll(async () => {
  fixture = await performanceFixture();
  await fixture.app.listen(0, '127.0.0.1');
  base = await fixture.app.getUrl();
}, 30000);
afterAll(async () => {
  sockets.forEach((socket) => socket.disconnect());
  await fixture?.close();
});
async function call(
  index: number | undefined,
  path: string,
  method = 'GET',
  body?: unknown,
) {
  return fetch(base + path, {
    method,
    headers: {
      ...(index === undefined
        ? {}
        : { Authorization: 'Bearer ' + fixture.tokens[index] }),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
describe('Защита центра уведомлений и доставка изменений', () => {
  it('закрывает чтение без входа, чужие истории и публикацию обычному пользователю', async () => {
    const id = fixture.users[1];
    expect(
      (await call(undefined, `/users/${id}/notification-center/summary`))
        .status,
    ).toBe(401);
    expect(
      (await call(2, `/users/${id}/notification-center/senders`)).status,
    ).toBe(403);
    expect((await call(1, '/admin/announcements')).status).toBe(403);
    expect(
      (
        await call(1, '/admin/announcements', 'POST', {
          title: 'Нет',
          body: 'Текст',
          category: 'NEWS',
        })
      ).status,
    ).toBe(403);
  });
  it('отклоняет лишние поля, некорректные страницы и опасные действия', async () => {
    const id = fixture.users[1];
    for (const query of [
      'limit=999',
      'offset=-1',
      'userId=other',
      'through=not-a-date',
    ])
      expect(
        (await call(1, `/users/${id}/notification-center/senders?${query}`))
          .status,
      ).toBe(400);
    expect(
      (
        await call(0, '/admin/announcements', 'POST', {
          title: 'Новость',
          body: 'Текст',
          category: 'NEWS',
          publishedAt: new Date().toISOString(),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(0, '/admin/announcements', 'POST', {
          title: 'Новость',
          body: 'Текст',
          category: 'NEWS',
          actions: [{ label: 'Опасно', path: 'javascript:alert(1)' }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(1, `/users/${id}/notification-center/read`, 'POST', {
          scope: 'person',
          actorId: fixture.users[2],
          through: new Date().toISOString(),
          senderId: fixture.users[2],
        })
      ).status,
    ).toBe(400);
  });
  it('не раскрывает переписку через строку поиска с кавычками и SQL', async () => {
    const result = await call(
      1,
      `/users/${fixture.users[1]}/notification-center/senders?q=${encodeURIComponent("' OR 1=1 --")}`,
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ items: [], total: 0 });
  });
  it('после прочтения события доставляет подтверждение в другую сессию и отправителю', async () => {
    const sender = fixture.users[4],
      receiver = fixture.users[5];
    const created = await fixture.app
      .get(MessageService)
      .create(sender, receiver, 'Проверка прочтения');
    const connect = async (index: number) => {
      const socket = io(base + '/chat', {
        autoConnect: false,
        auth: { token: fixture.tokens[index] },
        extraHeaders: { Origin: 'http://127.0.0.1:8096' },
        transports: ['websocket'],
      });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once('presence:snapshot', () => resolve());
        socket.once('connect_error', reject);
        socket.connect();
      });
      return socket;
    };
    const from = await connect(4),
      secondSession = await connect(5);
    const receive = (socket: Socket, name: string) =>
      new Promise<Record<string, string>>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Не получено ' + name)),
          5000,
        );
        socket.once(name, (data: Record<string, string>) => {
          clearTimeout(timer);
          resolve(data);
        });
      });
    const senderRead = receive(from, 'messages:read');
    const ownerRead = receive(secondSession, 'conversation:read');
    expect(
      (
        await call(
          5,
          `/users/${receiver}/notifications/${created.notification.id}/read`,
          'PATCH',
        )
      ).status,
    ).toBe(200);
    const [senderUpdate, ownerUpdate] = await Promise.all([
      senderRead,
      ownerRead,
    ]);
    expect(senderUpdate).toMatchObject({
      userId: receiver,
      messageId: created.message.id,
    });
    expect(ownerUpdate).toMatchObject({
      otherUserId: sender,
      messageId: created.message.id,
    });
    expect(
      (
        await fixture.db.prisma.message.findUniqueOrThrow({
          where: { id: created.message.id },
        })
      ).isRead,
    ).toBe(true);
    from.disconnect();
    secondSession.disconnect();
  });
  it('публикует черновик только по отдельному действию администратора', async () => {
    const created = await call(0, '/admin/announcements', 'POST', {
      title: 'Обновили поиск',
      body: 'Добавили фильтры.',
      category: 'NEWS',
      actions: [{ label: 'Каталог', path: '/library/catalog' }],
    });
    expect(created.status).toBe(201);
    const draft = (await created.json()) as { id: string };
    const path = `/users/${fixture.users[1]}/notification-center/system`;
    expect(await (await call(1, path)).json()).toMatchObject({ total: 0 });
    expect(
      (await call(0, '/admin/announcements/' + draft.id + '/publish', 'POST'))
        .status,
    ).toBe(201);
    expect(await (await call(1, path)).json()).toMatchObject({ total: 1 });
  });
});
