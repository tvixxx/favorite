import { json, type Request, type Response } from 'express';
import { performanceFixture } from './performance-fixture';
import { randomUUID } from 'node:crypto';

it('предоставляет временный backend для UI QA, затем удаляет только свой стенд', async () => {
  const fixture = await performanceFixture(false);
  const startedAt = new Date().toISOString();
  let mode = 'success';
  let delayMs = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const seedNow = Date.now();
    const day = 86400000;
    for (const [index, id] of fixture.users.entries()) {
      const age = 2 + (index % 8) * 7;
      const createdAt = new Date(seedNow - age * day);
      await fixture.db.prisma.user.update({
        where: { id },
        data: { createdAt },
      });
      const recentAgo = [1 / 24, 3, 10, 25][index % 4];
      const times = [new Date(seedNow - Math.min(recentAgo, age - 1) * day)];
      if (age >= 16 && Math.floor(index / 8) % 2 === 0)
        times.push(new Date(createdAt.getTime() + 7 * day));
      if (index === 7) times.push(new Date(createdAt.getTime() + day));
      await fixture.db.prisma.usageEvent.createMany({
        data: times.map((occurredAt) => ({
          id: randomUUID(),
          userId: id,
          feature: 'MOVIE_VIEW',
          occurredAt,
        })),
      });
    }
    await fixture.db.prisma.movie.updateMany({
      data: { createdAt: new Date(seedNow - 60 * day) },
    });
    const shift = seedNow - 5 * 60000 - Date.UTC(2026, 0, 1, 0, 0, 200);
    await fixture.db.prisma
      .$executeRaw`UPDATE user_movies SET added_at = added_at + ${shift}::double precision * interval '1 millisecond'`;
    await new Promise<void>((resolve, reject) => {
      const controlJson = json({ limit: '1kb' });
      // Nest ищет jsonParser по имени даже на отдельном маршруте, обёртка сохраняет общий parser.
      fixture.app.use(
        '/qa-mode',
        (req: Request, res: Response, next: () => void) =>
          controlJson(req, res, next),
      );
      fixture.app.use((req: Request, res: Response, next: () => void) => {
        if (req.path === '/qa-info') {
          res.json({
            pid: process.pid,
            kind: 'performance-ui',
            users: 100,
            movies: 1000,
            collection: 200,
            startedAt,
            mode,
            delayMs,
            mailCount: fixture.mail?.messages.length ?? 0,
          });
          return;
        }
        if (req.path === '/qa-stop' && req.method === 'POST') {
          res.json({ stopping: true });
          resolve();
          return;
        }
        if (req.path === '/qa-mode' && req.method === 'POST') {
          const body: unknown = req.body;
          if (
            !body ||
            typeof body !== 'object' ||
            !('mode' in body) ||
            !('delayMs' in body) ||
            !['success', 'empty', 'error'].includes(String(body.mode)) ||
            typeof body.delayMs !== 'number' ||
            !Number.isInteger(body.delayMs) ||
            body.delayMs < 0 ||
            body.delayMs > 10000
          ) {
            res.status(400).json({ message: 'Invalid QA mode' });
            return;
          }
          mode = String(body.mode);
          delayMs = body.delayMs;
          res.json({ mode, delayMs });
          return;
        }
        if (
          req.method === 'GET' &&
          [
            '/admin/overview',
            '/admin/users',
            '/admin/movies',
            '/admin/reviews',
            '/admin/feedback',
          ].includes(req.path)
        ) {
          const requestedMode = mode;
          setTimeout(() => {
            if (requestedMode === 'error') {
              res.status(503).json({ message: 'QA unavailable' });
              return;
            }
            if (requestedMode === 'empty' && req.path !== '/admin/overview') {
              res.json({ items: [], total: 0 });
              return;
            }
            next();
          }, delayMs);
          return;
        }
        next();
      });
      void fixture.app
        .listen(8095, '127.0.0.1')
        .then(() => console.log('FAVOURITE_UI_BACKEND_READY'))
        .catch(reject);
      timer = setTimeout(resolve, 1200000);
    });
  } finally {
    clearTimeout(timer);
    await fixture.close();
  }
}, 1250000);
