import 'reflect-metadata';
import { featuresDatabase } from './features-database';
import { NotificationCenterService } from '../src/notification/notification-center.service';
import { AnnouncementService } from '../src/notification/announcement.service';
import { NotificationService } from '../src/notification/notification.service';
import { MessageService } from '../src/message/message.service';
import type { PrismaService } from '../src/prisma/prisma.service';

let db: Awaited<ReturnType<typeof featuresDatabase>>;
let center: NotificationCenterService;
let announcements: AnnouncementService;
let notifications: NotificationService;
let messages: MessageService;
let owner: string;
let peer: string;
let third: string;
beforeAll(async () => {
  db = await featuresDatabase();
  const users = await Promise.all(
    ['owner', 'peer', 'third'].map((name) =>
      db.prisma.user.create({
        data: {
          email: name + '@example.test',
          fullName: name,
          password: 'unused',
          role: name === 'owner' ? 'ADMIN' : 'USER',
        },
      }),
    ),
  );
  [owner, peer, third] = users.map((u) => u.id);
  announcements = new AnnouncementService(db.prisma as PrismaService);
  center = new NotificationCenterService(
    db.prisma as PrismaService,
    announcements,
  );
  notifications = new NotificationService(db.prisma as PrismaService);
  messages = new MessageService(db.prisma as PrismaService);
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.prisma.notification.deleteMany();
  await db.prisma.message.deleteMany();
  await db.prisma.announcementRead.deleteMany();
  await db.prisma.announcement.deleteMany();
});

describe('Центр уведомлений с настоящей базой', () => {
  it('раскрытие одного события не прочитывает другие сообщения, которые пользователь не открывал', async () => {
    const older = await messages.create(peer, owner, 'Ещё не открыто');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const chosen = await messages.create(peer, owner, 'Открыто из истории');
    await notifications.markRead(owner, chosen.notification.id);
    expect(
      (
        await db.prisma.message.findUniqueOrThrow({
          where: { id: older.message.id },
        })
      ).isRead,
    ).toBe(false);
    expect(await notifications.unreadCount(owner)).toBe(1);
  });
  it('считает отправителей по всей истории и независимо листает события, не раскрывает чужие данные', async () => {
    for (let i = 0; i < 7; i++)
      await messages.create(peer, owner, 'Сообщение ' + i);
    await messages.create(third, owner, 'Другой человек');
    await messages.create(owner, third, 'Чужая переписка');
    const page = await center.senders(owner, { limit: 1, offset: 0 });
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    const events = await center.people(owner, peer, { limit: 3, offset: 3 });
    expect(events.total).toBe(7);
    expect(events.unread).toBe(7);
    expect(events.items).toHaveLength(3);
    expect(
      await center.people(third, peer, { limit: 3, offset: 0 }),
    ).toMatchObject({ total: 0, items: [] });
    expect(JSON.stringify(page)).not.toContain('password');
    expect(JSON.stringify(page)).not.toContain('@example.test');
  });

  it('получает полное сообщение, а не обрезанные двести символов', async () => {
    const text = 'Длинное сообщение '.repeat(50);
    await messages.create(peer, owner, text);
    const page = await center.people(owner, peer, { limit: 5, offset: 0 });
    expect(page.items[0].body).toBe(text);
  });

  it('прочтение чата убирает события из колокольчика, сохраняя чужой диалог', async () => {
    await messages.create(peer, owner, 'Привет');
    await messages.create(third, owner, 'Другая беседа');
    await messages.markConversationAsRead(owner, peer);
    expect(await notifications.unreadCount(owner)).toBe(1);
    expect(await messages.getUnreadCount(owner)).toBe(1);
  });

  it('прочтение события синхронизирует сообщения до него, не помечая новые', async () => {
    const first = await messages.create(peer, owner, 'Первое');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await messages.create(peer, owner, 'Следующее');
    await notifications.markRead(owner, first.notification.id);
    expect(await messages.getUnreadCount(owner)).toBe(1);
    expect(await notifications.unreadCount(owner)).toBe(1);
    expect(
      await notifications.markRead(third, first.notification.id),
    ).toBeNull();
  });

  it('черновик не виден, параллельная публикация одна, прочтение персональное', async () => {
    const draft = await announcements.createDraft({
      title: 'Новость',
      body: 'Что изменилось',
      category: 'NEWS',
      actions: [],
    });
    expect(
      (await announcements.page(peer, { limit: 10, offset: 0 })).total,
    ).toBe(0);
    await Promise.all([
      announcements.publish(draft.id, owner),
      announcements.publish(draft.id, owner),
    ]);
    expect(
      await db.prisma.adminAuditLog.count({ where: { targetId: draft.id } }),
    ).toBe(1);
    expect(
      (await announcements.page(peer, { limit: 10, offset: 0 })).unread,
    ).toBe(1);
    await Promise.all([
      announcements.markRead(peer, draft.id),
      announcements.markRead(peer, draft.id),
    ]);
    expect(
      (await announcements.page(peer, { limit: 10, offset: 0 })).unread,
    ).toBe(0);
    expect(
      (await announcements.page(third, { limit: 10, offset: 0 })).unread,
    ).toBe(1);
    await expect(
      announcements.updateDraft(draft.id, {
        title: 'Другое',
        body: 'Текст',
        category: 'NEWS',
        actions: [],
      }),
    ).rejects.toThrow();
  });

  it('повторный выпуск не дублирует и не перезаписывает опубликованную новость', async () => {
    const note = {
      id: '2026.10-notifications',
      title: 'Новая версия',
      body: 'Добавили центр уведомлений',
      actions: [],
    };
    await Promise.all([
      announcements.publishRelease(note),
      announcements.publishRelease(note),
    ]);
    await announcements.publishRelease({ ...note, body: 'Подменённый текст' });
    expect(await db.prisma.announcement.count()).toBe(1);
    expect(
      (await announcements.page(peer, { limit: 10, offset: 0 })).items[0].body,
    ).toBe(note.body);
  });

  it('массовое прочтение не затрагивает объявления после границы снимка', async () => {
    await announcements.publishRelease({
      id: 'old',
      title: 'Раньше',
      body: 'Текст',
      actions: [],
    });
    const through = new Date();
    await db.prisma.announcement.create({
      data: {
        title: 'Позже',
        body: 'Текст',
        category: 'NEWS',
        actions: [],
        publishedAt: new Date(through.getTime() + 50),
      },
    });
    await announcements.markAllRead(peer, through);
    expect(
      await db.prisma.announcementRead.count({ where: { userId: peer } }),
    ).toBe(1);
  });
});
