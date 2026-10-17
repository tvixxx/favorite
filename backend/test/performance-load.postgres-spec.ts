import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { io, type Socket } from '../../frontend/node_modules/socket.io-client';
import { performanceFixture } from './performance-fixture';
import { invalidateDataCache } from '../src/common/utils/data-revision';

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    Math.round(
      (sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0) * 10,
    ) / 10
  );
};

describe('Изолированный HTTP/WS профиль 5/20/50', () => {
  it('сохраняет контракты под параллельными чтениями/записями и штатными лимитами', async () => {
    const fixture = await performanceFixture();
    const sockets: Socket[] = [];
    const reports: unknown[] = [];
    try {
      await fixture.app.listen(0, '127.0.0.1');
      const base = await fixture.app.getUrl();
      const request = async (
        index: number,
        path: string,
        method = 'GET',
        body?: unknown,
      ) => {
        const start = performance.now();
        const response = await fetch(`${base}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${fixture.tokens[index]}`,
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });
        const text = await response.text();
        return {
          status: response.status,
          elapsed: performance.now() - start,
          bytes: Buffer.byteLength(text),
          data: JSON.parse(text) as unknown,
        };
      };
      expect(
        (await request(0, `/users/${fixture.users[1]}/movies/page`)).status,
      ).toBe(403);
      expect(
        (await request(0, `/users/${fixture.users[0]}/movies/page?limit=101`))
          .status,
      ).toBe(400);

      await Promise.all(
        fixture.users.slice(0, 50).map(
          (_, i) =>
            new Promise<void>((resolve, reject) => {
              const socket = io(`${base}/chat`, {
                auth: { token: fixture.tokens[i] },
                transports: ['websocket'],
                reconnection: false,
                extraHeaders: { Origin: 'http://127.0.0.1:8096' },
                forceNew: true,
                timeout: 10000,
              });
              sockets.push(socket);
              socket.once('connect', resolve);
              socket.once('connect_error', reject);
            }),
        ),
      );
      const connectedAt = performance.now();
      const deadline = Date.now() + 10000;
      while (
        (await fixture.db.prisma.userStatus.count({
          where: { isOnline: true },
        })) !== 50
      ) {
        if (Date.now() > deadline)
          throw new Error('Не подтверждено присутствие 50 QA пользователей');
        await delay(20);
      }
      while (
        fixture.db.pool.waitingCount ||
        fixture.db.pool.totalCount !== fixture.db.pool.idleCount
      ) {
        if (Date.now() > deadline)
          throw new Error('Не завершилась начальная регистрация сокетов');
        await delay(20);
      }

      for (const concurrency of [5, 20, 50]) {
        invalidateDataCache(fixture.db.prisma);
        const results: Array<{
          scenario: string;
          elapsed: number;
          bytes: number;
          status: number;
        }> = [];
        const lag = monitorEventLoopDelay({ resolution: 10 });
        const cpu = process.cpuUsage();
        let rss = process.memoryUsage().rss;
        let waiting = fixture.db.pool.waitingCount;
        const sampler = setInterval(() => {
          rss = Math.max(rss, process.memoryUsage().rss);
          waiting = Math.max(waiting, fixture.db.pool.waitingCount);
        }, 10);
        fixture.db.queryDurations.length = 0;
        lag.enable();
        const start = performance.now();
        try {
          const completed = await Promise.allSettled(
            Array.from({ length: concurrency }, async (_, index) => {
              const user = fixture.users[index];
              const paths: Array<[string, string]> = [
                ['catalog', '/movies/page?limit=20'],
                ['suggestions', '/movies/suggestions?q=QA&limit=10'],
                ['collection', `/users/${user}/movies/page?limit=20`],
                [
                  'favourites',
                  `/users/${user}/movies/page?isFavorite=true&limit=20`,
                ],
                ['detail', `/users/${user}/movies/${fixture.movies[0]}`],
                ['stats', `/users/${user}/movies/stats`],
                [
                  'ranking-users-cold',
                  `/leaderboard/top-users?limit=20&offset=${(index % 5) * 20}`,
                ],
                [
                  'ranking-movies-cold',
                  `/leaderboard/top-movies?limit=20&offset=${index * 20}`,
                ],
              ];
              for (const [scenario, path] of paths) {
                const result = await request(index, path);
                expect(result.status).toBe(200);
                results.push({ scenario, ...result });
                if (
                  ['catalog', 'collection', 'favourites'].includes(scenario)
                ) {
                  const page = result.data as {
                    items: unknown[];
                    total: number;
                  };
                  expect(page.items).toHaveLength(20);
                  expect(page.total).toBe(
                    scenario === 'catalog'
                      ? 1000
                      : scenario === 'favourites'
                        ? 67
                        : 200,
                  );
                }
              }
              const rating = await request(
                index,
                `/users/${user}/movies/${fixture.movies[0]}/rating`,
                'PATCH',
                { personalRate: (index % 10) + 1 },
              );
              expect(rating.status).toBe(200);
              results.push({ scenario: 'rating-write', ...rating });
              const created = await request(
                index,
                `/users/${user}/lists`,
                'POST',
                { name: `Load ${concurrency}-${index}` },
              );
              expect(created.status).toBe(201);
              const listId = (created.data as { id: string }).id;
              expect(typeof listId).toBe('string');
              results.push({ scenario: 'list-write', ...created });
              const removed = await request(
                index,
                `/users/${user}/lists/${listId}`,
                'DELETE',
              );
              expect(removed.status).toBe(200);
              results.push({ scenario: 'list-delete', ...removed });
            }),
          );
          const failed = completed.find(
            (result) => result.status === 'rejected',
          );
          if (failed?.status === 'rejected') throw failed.reason;
          // После всех записей revision стабилен, поэтому повторный этап действительно читает кэш.
          for (const [scenario, path] of [
            ['ranking-users', '/leaderboard/top-users?limit=20'],
            ['ranking-movies', '/leaderboard/top-movies?limit=20'],
          ]) {
            const fill = await request(0, path);
            expect(fill.status).toBe(200);
            results.push({ scenario: `${scenario}-fill`, ...fill });
            const warm = await Promise.allSettled(
              Array.from({ length: concurrency }, async (_, index) => {
                const result = await request(index, path);
                expect(result.status).toBe(200);
                results.push({ scenario: `${scenario}-warm`, ...result });
              }),
            );
            const warmFailure = warm.find(
              (result) => result.status === 'rejected',
            );
            if (warmFailure?.status === 'rejected') throw warmFailure.reason;
          }
          const duration = performance.now() - start;
          const used = process.cpuUsage(cpu);
          reports.push({
            concurrency,
            requests: results.length,
            durationMs: Math.round(duration),
            burstRps: Math.round((results.length * 1000) / duration),
            latencyMs: {
              p50: percentile(
                results.map((r) => r.elapsed),
                0.5,
              ),
              p95: percentile(
                results.map((r) => r.elapsed),
                0.95,
              ),
              p99: percentile(
                results.map((r) => r.elapsed),
                0.99,
              ),
            },
            maxJsonBytes: Math.max(...results.map((r) => r.bytes)),
            errors: results.filter((r) => r.status >= 400).length,
            processCpuMs: Math.round((used.user + used.system) / 1000),
            maxProcessRssMiB: Math.round(rss / 1048576),
            eventLoopP99Ms: Math.round(lag.percentile(99) / 1e5) / 10,
            maxPoolWaiting: waiting,
            dbQueryP95Ms: percentile(fixture.db.queryDurations, 0.95),
            scenarios: Object.fromEntries(
              [...new Set(results.map((r) => r.scenario))].map((scenario) => [
                scenario,
                {
                  p95Ms: percentile(
                    results
                      .filter((r) => r.scenario === scenario)
                      .map((r) => r.elapsed),
                    0.95,
                  ),
                },
              ]),
            ),
          });
        } finally {
          clearInterval(sampler);
          lag.disable();
        }
      }

      const acks = await Promise.all(
        sockets.map(
          (socket, index) =>
            socket.timeout(10000).emitWithAck('message:send', {
              receiverId:
                fixture.users[index % 2 === 0 ? index + 1 : index - 1],
              content: 'QA load message',
            }) as Promise<{ id?: string; error?: string }>,
        ),
      );
      expect(
        acks.every((ack) => typeof ack.id === 'string' && !ack.error),
      ).toBe(true);
      expect(await fixture.db.prisma.message.count()).toBe(50);

      const limits = await Promise.all(
        Array.from({ length: 210 }, () => request(0, '/movies/stats')),
      );
      expect(limits.every((result) => [200, 429].includes(result.status))).toBe(
        true,
      );
      expect(limits.some((result) => result.status === 429)).toBe(true);
      reports.push({
        throttle: {
          ok: limits.filter((r) => r.status === 200).length,
          rejected429: limits.filter((r) => r.status === 429).length,
        },
      });
      await delay(Math.max(0, 60000 - (performance.now() - connectedAt)));
      expect(sockets.every((socket) => socket.connected)).toBe(true);
      reports.push({
        websocket: {
          connections: 50,
          acknowledgedMessages: 50,
          heldMs: Math.round(performance.now() - connectedAt),
        },
        scope:
          'Local Node test process includes Nest, Jest and HTTP generator. PG18 amd64 container. No nginx/VPS capacity claim.',
      });
      await writeFile(
        '/private/tmp/favourite-performance-20261014.json',
        JSON.stringify(reports, null, 2),
      );
      console.log('FAVOURITE_PERFORMANCE_CHECK_OK', JSON.stringify(reports));
    } finally {
      sockets.forEach((socket) => socket.disconnect());
      await fixture.close();
    }
  }, 180000);
});
