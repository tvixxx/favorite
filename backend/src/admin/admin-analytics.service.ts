import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UsageEventDto } from './admin.dto';
import { TtlCache } from '../common/utils/ttl-cache';

@Injectable()
export class AdminAnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminAnalyticsService.name);
  private readonly cache = new TtlCache<
    Awaited<ReturnType<AdminAnalyticsService['loadOverview']>>
  >(30_000);
  private cleanupTimer?: ReturnType<typeof setInterval>;
  constructor(private readonly prisma: PrismaService) {}

  public onModuleInit(): void {
    this.cleanupTimer = setInterval(
      () => void this.cleanup(),
      24 * 60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
    void this.cleanup();
  }

  public onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  private async cleanup(): Promise<void> {
    try {
      await this.prisma.usageEvent.deleteMany({
        where: { occurredAt: { lt: new Date(Date.now() - 90 * 86_400_000) } },
      });
      this.cache.clear();
    } catch {
      this.logger.warn('Не удалось очистить устаревшие события аналитики');
    }
  }

  public async record(userId: string, event: UsageEventDto): Promise<void> {
    await this.prisma.usageEvent.createMany({
      data: [{ id: event.id, feature: event.feature, userId }],
      skipDuplicates: true,
    });
    this.cache.clear();
  }

  public overview(days: number) {
    return this.cache.wrap(String(days), () => this.loadOverview(days));
  }

  private async loadOverview(days: number) {
    const until = new Date();
    const dayMs = 86_400_000;
    const offsetMs = 4 * 60 * 60 * 1000;
    const today =
      Math.floor((until.getTime() + offsetMs) / dayMs) * dayMs - offsetMs;
    const since = new Date(today - (days - 1) * dayMs);
    const historySince = new Date(until.getTime() - 90 * dayMs);
    const inactiveBefore = new Date(until.getTime() - 28 * dayMs);
    const [
      users,
      movies,
      serials,
      reviews,
      newFeedback,
      registrations,
      features,
      heatmap,
      started,
      active,
      returning,
      inactive,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.movie.count(),
      this.prisma.movie.count({ where: { isSerial: true } }),
      this.prisma.review.count({ where: { hiddenAt: null } }),
      this.prisma.feedback.count({ where: { status: 'NEW' } }),
      this.prisma.$queryRaw<Array<{ day: string; count: number }>>`
        SELECT to_char(created_at + interval '4 hours', 'YYYY-MM-DD') AS day,
               count(*)::int AS count
        FROM users
        WHERE created_at >= ${since} AND created_at <= ${until}
        GROUP BY day ORDER BY day
      `,
      this.prisma.$queryRaw<
        Array<{ feature: string; users: number; actions: number }>
      >`
        SELECT feature, count(DISTINCT user_id)::int AS users, count(*)::int AS actions
        FROM usage_events
        WHERE occurred_at >= ${since} AND occurred_at <= ${until}
        GROUP BY feature ORDER BY users DESC, feature
      `,
      this.prisma.$queryRaw<
        Array<{ day: number; hour: number; users: number }>
      >`
        SELECT extract(isodow FROM occurred_at + interval '4 hours')::int AS day,
               extract(hour FROM occurred_at + interval '4 hours')::int AS hour,
               count(DISTINCT user_id)::int AS users
        FROM usage_events
        WHERE occurred_at >= ${since} AND occurred_at <= ${until}
        GROUP BY day, hour ORDER BY day, hour
      `,
      this.prisma.usageEvent.aggregate({
        where: { occurredAt: { gte: historySince, lte: until } },
        _min: { occurredAt: true },
      }),
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT count(DISTINCT user_id)::int AS count FROM usage_events
        WHERE occurred_at >= ${since} AND occurred_at <= ${until}
      `,
      this.prisma.$queryRaw<Array<{ count: number }>>`
        WITH visits AS (
          SELECT user_id, occurred_at,
                 lag(occurred_at) OVER (PARTITION BY user_id ORDER BY occurred_at, id) AS previous
          FROM usage_events
          WHERE occurred_at >= ${historySince} AND occurred_at <= ${until}
        )
        SELECT count(DISTINCT user_id)::int AS count FROM visits
        WHERE occurred_at >= ${since}
          AND previous <= occurred_at - interval '28 days'
      `,
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::int AS count FROM (
          SELECT user_id FROM usage_events
          WHERE occurred_at >= ${historySince} AND occurred_at <= ${until}
          GROUP BY user_id HAVING max(occurred_at) <= ${inactiveBefore}
        ) inactive_users
      `,
    ]);

    return {
      users,
      movies,
      serials,
      reviews,
      newFeedback,
      registrations,
      features,
      heatmap,
      active: active[0]?.count ?? 0,
      returning:
        started._min.occurredAt &&
        started._min.occurredAt.getTime() <= inactiveBefore.getTime()
          ? (returning[0]?.count ?? 0)
          : null,
      inactive:
        started._min.occurredAt &&
        started._min.occurredAt.getTime() <= inactiveBefore.getTime()
          ? (inactive[0]?.count ?? 0)
          : null,
      startedAt: started._min.occurredAt,
      since: since.toISOString(),
      until: until.toISOString(),
      timezone: 'UTC+4',
      days,
    };
  }
}
