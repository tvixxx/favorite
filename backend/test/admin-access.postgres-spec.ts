import { randomBytes, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createServer, type Server as HttpServer } from 'node:http';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { hash } from 'argon2';
import type { Request, Response } from 'express';
import { Server } from 'socket.io';
// Клиент уже установлен во frontend, отдельная зависимость backend не нужна.
import { io, type Socket } from '../../frontend/node_modules/socket.io-client';
import { PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { AdminService } from '../src/admin/admin.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { MessageGateway } from '../src/message/message.gateway';
import { UserService } from '../src/user/user.service';
import { lockResource } from '../src/common/utils/transaction-lock';

// Только одноразовый контейнер на отдельном порту, рабочий DATABASE_URL не читается.
const connectionString =
  'postgresql://access_qa:access-qa-local-only@127.0.0.1:55440/access_qa';
const database = `access_qa_${randomBytes(8).toString('hex')}`;
const control = new Client({ connectionString });
const config = new ConfigService({
  JWT_SECRET: 'access-qa-test-only-key',
  JWT_ACCESS_TOKEN_TTL: '15m',
  JWT_REFRESH_TOKEN_TTL: '12h',
  COOKIE_DOMAIN: 'localhost',
  NODE_ENV: 'development',
});
const jwt = new JwtService({ secret: 'access-qa-test-only-key' });
let prisma: PrismaClient;
let createdDatabase = false;
let http: HttpServer;
let server: Server;
let gateway: MessageGateway;
let admin: AdminService;
let auth: AuthService;
let users: UserService;
let clients: Socket[];
let online: Set<string>;
let messages: string[];
let url: string;
let migratedVersions: number[];

async function user(
  role: 'ADMIN' | 'USER' = 'ADMIN',
  password = 'not-a-login-hash',
): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `${id}@example.test`,
      fullName: 'QA access',
      password,
      role,
    },
  });
  return id;
}

async function waitFor(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() >= deadline)
      throw new Error('Ожидаемое состояние соединения не наступило');
    await delay(10);
  }
}

function connect(token: string): Socket {
  const socket = io(`${url}/chat`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  clients.push(socket);
  return socket;
}

beforeAll(async () => {
  await control.connect();
  const { rows } = await control.query<{ name: string; version: number }>(
    "SELECT current_database() AS name, current_setting('server_version_num')::int AS version",
  );
  expect(rows[0].name).toBe('access_qa');
  expect(Math.floor(rows[0].version / 10000)).toBe(18);
  await control.query(`CREATE DATABASE "${database}"`);
  createdDatabase = true;
  const testUrl = connectionString.replace(/\/access_qa$/, `/${database}`);
  const migrationClient = new Client({ connectionString: testUrl });
  try {
    await migrationClient.connect();
    const directory = join(__dirname, '../prisma/migrations');
    const migrations = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const migration of migrations) {
      if (migration === '20261014000000_revoke_blocked_user_sessions') {
        await migrationClient.query(
          `INSERT INTO users (id, email, password, "fullName", updated_at, blocked_at)
           VALUES ($1, 'active@example.test', 'not-a-login-hash', 'QA active', NOW(), NULL),
                  ($2, 'blocked@example.test', 'not-a-login-hash', 'QA blocked', NOW(), NOW())`,
          [randomUUID(), randomUUID()],
        );
      }
      await migrationClient.query(
        await readFile(join(directory, migration, 'migration.sql'), 'utf8'),
      );
    }
    const result = await migrationClient.query<{ auth_version: number }>(
      'SELECT auth_version FROM users ORDER BY email',
    );
    migratedVersions = result.rows.map((row) => row.auth_version);
  } finally {
    await migrationClient.end();
  }
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testUrl }),
  });
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
  clients = [];
  online = new Set();
  messages = [];
  auth = new AuthService(prisma as PrismaService, config, jwt);
  gateway = new MessageGateway(
    {
      create: (sender: string) => {
        messages.push(sender);
        return Promise.resolve({
          message: { id: randomUUID() },
          notification: {},
        });
      },
    } as never,
    {
      setOnline: (id: string) => Promise.resolve(online.add(id)),
      setOffline: (id: string) => Promise.resolve(online.delete(id)),
      getOnlineFriends: () => Promise.resolve([]),
    } as never,
    { getFriends: () => Promise.resolve([]) } as never,
    { toDto: () => ({}) } as never,
    auth,
  );
  http = createServer();
  server = new Server(http);
  const chat = server.of('/chat');
  gateway.server = chat as unknown as Server;
  chat.on('connection', (client) => {
    client.on('disconnect', () => void gateway.handleDisconnect(client));
    client.on(
      'message:send',
      (
        data: { receiverId: string; content: string },
        ack: (result: unknown) => void,
      ) => void gateway.handleMessage(data, client).then(ack),
    );
    void gateway.handleConnection(client);
  });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
  admin = new AdminService(prisma as PrismaService, gateway);
  users = new UserService(
    prisma as PrismaService,
    { release: () => Promise.resolve() } as never,
  );
});

afterEach(async () => {
  clients?.forEach((client) => client.close());
  if (server) {
    await server.close();
  }
});

afterAll(async () => {
  await prisma?.$disconnect();
  try {
    if (createdDatabase)
      await control.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  } finally {
    await control.end();
  }
});

describe('Конкурентный доступ и отзыв сессий на PostgreSQL 18', () => {
  it('при миграции отзывает прежние сессии уже заблокированных аккаунтов и сохраняет активные', () => {
    expect(migratedVersions).toEqual([0, 1]);
  });
  it.each(['role', 'blocked'] as const)(
    'сохраняет одного администратора при встречном изменении %s',
    async (kind) => {
      const first = await user();
      const second = await user();
      const dto =
        kind === 'role'
          ? { role: 'USER' as const, reason: 'QA role' }
          : { blocked: true, reason: 'QA block' };
      const results = await Promise.allSettled([
        admin.changeUser(second, dto, first),
        admin.changeUser(first, dto, second),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = results.find(
        (result) => result.status === 'rejected',
      ) as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ForbiddenException);
      expect(
        await prisma.user.count({ where: { role: 'ADMIN', blockedAt: null } }),
      ).toBe(1);
      expect(await prisma.adminAuditLog.count()).toBe(1);
    },
  );

  it('согласует одновременное удаление и понижение роли администраторов', async () => {
    const first = await user();
    const second = await user();
    const results = await Promise.allSettled([
      users.delete(second, first),
      admin.changeUser(first, { role: 'USER', reason: 'QA role' }, second),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      await prisma.user.count({ where: { role: 'ADMIN', blockedAt: null } }),
    ).toBe(1);
  });

  it('не удаляет последнего администратора и не позволяет изменить собственный доступ', async () => {
    const id = await user();
    await expect(users.delete(id)).rejects.toBeInstanceOf(ConflictException);
    await expect(
      admin.changeUser(id, { role: 'USER', reason: 'QA' }, id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      admin.changeUser(id, { blocked: true, reason: 'QA' }, id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      await prisma.user.count({ where: { role: 'ADMIN', blockedAt: null } }),
    ).toBe(1);
  });

  it.each(['role', 'blocked'] as const)(
    'отклоняет ожидающее удаление после изменения доступа инициатора: %s',
    async (kind) => {
      const actor = await user();
      const target = await user('USER');
      let release!: () => void;
      let locked!: () => void;
      const ready = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      const changing = prisma.$transaction(async (tx) => {
        await lockResource(tx, 'admin:user-access');
        locked();
        await hold;
        await tx.user.update({
          where: { id: actor },
          data: kind === 'role' ? { role: 'USER' } : { blockedAt: new Date() },
        });
      });
      await ready;
      const deleting = users.delete(target, actor);
      release();
      await changing;
      await expect(deleting).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        await prisma.user.findUnique({ where: { id: target } }),
      ).not.toBeNull();
    },
  );

  it('немедленно применяет новую роль к прежнему действующему access-токену', async () => {
    const actor = await user();
    const target = await user();
    const token = jwt.sign({ id: target, type: 'access', authVersion: 0 });
    const strategy = new JwtStrategy(auth, config);
    expect((await strategy.validate(jwt.verify(token))).role).toBe('ADMIN');
    await admin.changeUser(target, { role: 'USER', reason: 'QA' }, actor);
    expect((await strategy.validate(jwt.verify(token))).role).toBe('USER');
  });

  it('отключает все живые сокеты и не оживляет прежние токены после разблокировки', async () => {
    const actor = await user();
    const target = await user('USER', await hash('access-qa-password'));
    let refreshToken = '';
    const response = {
      cookie: (_key: string, value: string) => {
        refreshToken = value;
      },
    } as Response;
    const login = async () =>
      auth.login(response, {
        email: `${target}@example.test`,
        password: 'access-qa-password',
      });
    const oldSession = await login();
    const oldRefresh = refreshToken;
    const first = connect(oldSession.accessToken);
    const second = connect(oldSession.accessToken);
    await waitFor(
      () => first.connected && second.connected && online.has(target),
    );
    const sent: unknown = await first
      .timeout(3000)
      .emitWithAck('message:send', { receiverId: actor, content: 'QA' });
    expect(sent).toHaveProperty('id');
    expect(messages).toEqual([target]);

    await admin.changeUser(target, { blocked: true, reason: 'QA' }, actor);
    await waitFor(
      () => !first.connected && !second.connected && !online.has(target),
    );
    await expect(login()).rejects.toMatchObject({ status: 401 });
    await admin.changeUser(target, { blocked: false, reason: 'QA' }, actor);
    await expect(
      auth.verifyAccessToken(oldSession.accessToken),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      auth.refresh(
        { cookies: { refresh_token: oldRefresh } } as unknown as Request,
        response,
      ),
    ).rejects.toMatchObject({ status: 401 });

    const stale = connect(oldSession.accessToken);
    let refused = false;
    stale.on('disconnect', () => {
      refused = true;
    });
    await waitFor(() => refused);
    expect(online.has(target)).toBe(false);
    const fresh = await login();
    const renewed = connect(fresh.accessToken);
    await waitFor(() => renewed.connected && online.has(target));
    await expect(
      auth.refresh(
        { cookies: { refresh_token: refreshToken } } as unknown as Request,
        response,
      ),
    ).resolves.toHaveProperty('accessToken');
  });
});
