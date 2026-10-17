import { featuresDatabase } from './features-database';
import { ActorService } from '../src/actor/actor.service';
import type { PrismaService } from '../src/prisma/prisma.service';

it('выбирает русские имена до ограничения страницы и параметризует поисковую строку', async () => {
  const db = await featuresDatabase();
  try {
    await db.prisma.actor.createMany({
      data: [
        ...Array.from({ length: 110 }, (_, index) => ({
          name: `English Actor ${index}`,
        })),
        { name: 'Юрий Борисов' },
        { name: 'Александр Петров' },
      ],
    });
    const service = new ActorService(db.prisma as PrismaService, {} as never);
    const page = await service.findMany({
      limit: 1,
      offset: 0,
      order: 'ru-first',
    });
    expect(page.items.map((actor) => actor.name)).toEqual(['Александр Петров']);
    expect(page.total).toBe(112);
    const next = await service.findMany({
      limit: 1,
      offset: 1,
      order: 'ru-first',
    });
    expect(next.items.map((actor) => actor.name)).toEqual(['Юрий Борисов']);
    const hostile = await service.findMany({
      q: "%' OR 1=1 --",
      limit: 10,
      offset: 0,
      order: 'ru-first',
    });
    expect(hostile.items).toEqual([]);
    expect(hostile.total).toBe(0);
  } finally {
    await db.close();
  }
});
