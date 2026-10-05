import { Test } from '@nestjs/testing';
import type { AddressInfo, Socket } from 'node:net';
import type { IncomingMessage, Server } from 'node:http';
import { createConnection } from 'node:net';

it('завершает приложение с открытым upgraded HTTP-соединением', async () => {
  const module = await Test.createTestingModule({}).compile();
  const app = module.createNestApplication({ forceCloseConnections: true });

  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;

  server.on('upgrade', (_request: IncomingMessage, socket: Socket) => {
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n',
    );
  });
  const client = createConnection(
    (server.address() as AddressInfo).port,
    '127.0.0.1',
  );

  try {
    await new Promise<void>((resolve, reject) => {
      client.once('error', reject);
      client.once('data', () => resolve());
      client.once('connect', () =>
        client.write(
          'GET /socket HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n',
        ),
      );
    });
    const closed = new Promise<void>((resolve) =>
      client.once('close', () => resolve()),
    );

    await app.close();
    await closed;
    expect(client.destroyed).toBe(true);
  } finally {
    client.destroy();
    await app.close();
  }
}, 2000);
