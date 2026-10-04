import { Test } from '@nestjs/testing';
import type { Socket, Server } from 'socket.io';
import { MessageGateway } from './message.gateway';
import { MessageService } from './message.service';
import { UserStatusService } from '../user-status/user-status.service';
import { FriendshipService } from '../friendship/friendship.service';
import { NotificationService } from '../notification/notification.service';
import { AuthService } from '../auth/auth.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Доступ к чату и несколько вкладок', () => {
  let gateway: MessageGateway;
  let online: Set<string>;
  let created: Array<{ senderId: string; content: string }>;
  let auth: { verifyAccessToken: jest.Mock };
  let emitted: Array<{ room: string; event: string }>;
  let disconnected: string[];

  const socket = (id: string, token?: string, claimedId = 'user-id'): Socket =>
    ({
      id,
      data: {},
      handshake: { auth: { token, userId: claimedId }, query: {} },
      join: jest.fn(),
      disconnect: jest.fn(() => disconnected.push(id)),
    }) as unknown as Socket;

  beforeEach(async () => {
    online = new Set();
    created = [];
    emitted = [];
    disconnected = [];
    auth = {
      verifyAccessToken: jest.fn((token: string) => {
        if (token !== 'valid-access')
          return Promise.reject(new Error('Invalid token'));
        return Promise.resolve({ id: 'user-id' });
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        MessageGateway,
        { provide: AuthService, useValue: auth },
        {
          provide: MessageService,
          useValue: {
            create: jest.fn(
              (senderId: string, _receiver: string, content: string) => {
                created.push({ senderId, content });
                return Promise.resolve({
                  id: 'message-id',
                  sender: { fullName: 'Тест' },
                });
              },
            ),
            markConversationAsRead: jest.fn(),
          },
        },
        {
          provide: UserStatusService,
          useValue: {
            setOnline: jest.fn((id: string) => Promise.resolve(online.add(id))),
            setOffline: jest.fn((id: string) =>
              Promise.resolve(online.delete(id)),
            ),
            getStatus: jest.fn().mockResolvedValue(null),
            getOnlineFriends: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: FriendshipService,
          useValue: { getFriends: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NotificationService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
            toDto: jest.fn(() => ({})),
          },
        },
      ],
    }).compile();
    gateway = module.get(MessageGateway);
    const broadcast = (room: string) => ({
      emit: (event: string) => emitted.push({ room, event }),
      except: () => broadcast(room),
    });
    gateway.server = { to: broadcast } as unknown as Server;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('не подключает пользователя по одному userId без токена', async () => {
    const client = socket('socket-1');
    await gateway.handleConnection(client);
    expect(disconnected).toEqual(['socket-1']);
    expect(online.size).toBe(0);
  });

  it('берёт отправителя из проверенного токена вместо заявленного userId', async () => {
    const client = socket('socket-1', 'valid-access', 'someone-else');
    await gateway.handleConnection(client);
    await gateway.handleMessage(
      { receiverId: 'peer-id', content: 'Привет' },
      client,
    );
    expect(created).toEqual([{ senderId: 'user-id', content: 'Привет' }]);
  });

  it('не отправляет сообщения через неподтверждённое соединение', async () => {
    const client = socket('socket-1', 'bad-token');
    await gateway.handleConnection(client);
    await gateway.handleMessage(
      { receiverId: 'peer-id', content: 'Привет' },
      client,
    );
    expect(created).toEqual([]);
  });

  it('оставляет пользователя онлайн после закрытия одной из двух вкладок', async () => {
    const first = socket('socket-1', 'valid-access');
    const second = socket('socket-2', 'valid-access');
    await gateway.handleConnection(first);
    await gateway.handleConnection(second);
    await gateway.handleDisconnect(first);
    expect(online.has('user-id')).toBe(true);
    await gateway.handleDisconnect(second);
    expect(online.has('user-id')).toBe(false);
  });

  it('доставляет уведомление в общую комнату всех вкладок пользователя', async () => {
    await gateway.emitToUser('user-id', {} as never);
    expect(emitted).toEqual([
      { room: 'user:user-id', event: 'notification:new' },
    ]);
  });

  it('не сохраняет пустое сообщение', async () => {
    const client = socket('socket-1', 'valid-access');
    await gateway.handleConnection(client);
    await gateway.handleMessage(
      { receiverId: 'peer-id', content: '   ' },
      client,
    );
    expect(created).toEqual([]);
  });
});
