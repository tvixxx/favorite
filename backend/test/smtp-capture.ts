import { createServer, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';

/** Только loopback capture для интеграционных тестов, не почтовый сервер приложения. */
export async function smtpCapture() {
  const messages: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => socket.destroy());
    socket.setEncoding('utf8');
    socket.write('220 qa.example.test ESMTP\r\n');
    let buffer = '';
    let receiving = false;
    let message: string[] = [];
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (receiving) {
          if (line === '.') {
            messages.push(message.join('\r\n'));
            message = [];
            receiving = false;
            socket.write('250 queued\r\n');
          } else message.push(line.startsWith('..') ? line.slice(1) : line);
          continue;
        }
        const command = line.toUpperCase();
        if (command.startsWith('EHLO') || command.startsWith('HELO'))
          socket.write('250-qa.example.test\r\n250 SIZE 1048576\r\n');
        else if (command === 'DATA') {
          receiving = true;
          socket.write('354 End with dot\r\n');
        } else if (command === 'QUIT') socket.end('221 Bye\r\n');
        else if (
          command.startsWith('MAIL FROM:') ||
          command.startsWith('RCPT TO:') ||
          command === 'RSET' ||
          command === 'NOOP'
        )
          socket.write('250 OK\r\n');
        else socket.write('500 Unsupported command\r\n');
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    messages,
    port: (server.address() as AddressInfo).port,
    close: async () => {
      sockets.forEach((socket) => socket.destroy());
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
