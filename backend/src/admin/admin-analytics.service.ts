import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UsageEventDto } from './admin.dto';
import { TtlCache } from '../common/utils/ttl-cache';
import { dataRevision } from '../common/utils/data-revision';
import { ZonedCalendar } from '../common/utils/timezone';

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

  public overview(days: number, timezone = 'UTC') {
    return this.cache.wrap(
      `${days}:${timezone}:${dataRevision(this.prisma)}`,
      () => this.loadOverview(days, timezone),
    );
  }

  private async loadOverview(days: number, timezone: string) {
    const until = new Date();
    const dayMs = 86_400_000;
    const calendar = new ZonedCalendar(timezone);
    const zone = calendar.zone;
    const today = calendar.dateKey(until);
    const since = calendar.startOfDay(calendar.addDays(today, -(days - 1)));
    const historySince = new Date(until.getTime() - 90 * dayMs);
    const inactiveBefore = new Date(until.getTime() - 28 * dayMs);
    const weekStart = calendar.addDays(
      today,
      -((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7),
    );
    const firstCohort = calendar.addDays(weekStart, -56);
    const lastCohort = calendar.addDays(weekStart, -7);
    const daySince = new Date(until.getTime() - dayMs);
    const weekSince = new Date(until.getTime() - 7 * dayMs);
    const monthSince = new Date(until.getTime() - 30 * dayMs);
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
      activity,
      cohorts,
      funnel,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.movie.count(),
      this.prisma.movie.count({ where: { isSerial: true } }),
      this.prisma.review.count({ where: { hiddenAt: null } }),
      this.prisma.feedback.count({ where: { status: 'NEW' } }),
      this.prisma.$queryRaw<Array<{ day: string; count: number }>>`
        SELECT to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE ${zone}, 'YYYY-MM-DD') AS day,
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
        SELECT extract(isodow FROM occurred_at AT TIME ZONE 'UTC' AT TIME ZONE ${zone})::int AS day,
               extract(hour FROM occurred_at AT TIME ZONE 'UTC' AT TIME ZONE ${zone})::int AS hour,
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
      this.prisma.$queryRaw<Array<{ dau: number; wau: number; mau: number }>>`
        SELECT count(DISTINCT user_id) FILTER (WHERE occurred_at >= ${daySince})::int AS dau,
               count(DISTINCT user_id) FILTER (WHERE occurred_at >= ${weekSince})::int AS wau,
               count(DISTINCT user_id)::int AS mau
        FROM usage_events WHERE occurred_at >= ${monthSince} AND occurred_at <= ${until}
      `,
      this.prisma.$queryRaw<
        Array<{ week: string; registered: number; returned: number }>
      >`
        WITH weeks AS (
          SELECT generate_series(${firstCohort}::timestamp, ${lastCohort}::timestamp, interval '7 days') AS week
        )
        SELECT to_char(w.week, 'YYYY-MM-DD') AS week,
               count(u.id)::int AS registered,
               count(u.id) FILTER (WHERE EXISTS (
                 SELECT 1 FROM usage_events e
                 WHERE e.user_id = u.id
                   AND e.occurred_at >= ((w.week + interval '7 days') AT TIME ZONE ${zone} AT TIME ZONE 'UTC')
                   AND e.occurred_at < ((w.week + interval '14 days') AT TIME ZONE ${zone} AT TIME ZONE 'UTC')
                   AND e.occurred_at <= ${until}
               ))::int AS returned
        FROM weeks w LEFT JOIN users u
          ON u.created_at >= (w.week AT TIME ZONE ${zone} AT TIME ZONE 'UTC')
          AND u.created_at < ((w.week + interval '7 days') AT TIME ZONE ${zone} AT TIME ZONE 'UTC')
        GROUP BY w.week ORDER BY w.week DESC
      `,
      this.prisma.$queryRaw<
        Array<{ registered: number; collected: number; rated: number }>
      >`
        WITH new_users AS (SELECT id, created_at FROM users WHERE created_at >= ${since} AND created_at <= ${until})
        SELECT count(*)::int AS registered,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM user_movies um WHERE um.user_id = u.id AND um.added_at >= u.created_at AND um.added_at <= ${until}
          ))::int AS collected,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM user_movies um WHERE um.user_id = u.id AND um.added_at >= u.created_at AND um.added_at <= ${until}
              AND (um.personal_rate > 0 OR EXISTS (
                SELECT 1 FROM reviews r WHERE r.user_id = u.id AND r.movie_id = um.movie_id
                  AND r.created_at >= um.added_at AND r.created_at <= ${until}
              ))
          ))::int AS rated
        FROM new_users u
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
      timezone: zone,
      days,
      engagement: {
        activity: {
          ...(activity[0] ?? { dau: 0, wau: 0, mau: 0 }),
          complete: {
            day:
              !!started._min.occurredAt && started._min.occurredAt <= daySince,
            week:
              !!started._min.occurredAt && started._min.occurredAt <= weekSince,
            month:
              !!started._min.occurredAt &&
              started._min.occurredAt <= monthSince,
          },
        },
        funnel: funnel[0] ?? { registered: 0, collected: 0, rated: 0 },
        retention: cohorts.map((cohort) => {
          const followup = calendar
            .startOfDay(calendar.addDays(cohort.week, 7))
            .getTime();
          const followupEnd = calendar
            .startOfDay(calendar.addDays(cohort.week, 14))
            .getTime();
          const state = !cohort.registered
            ? 'empty'
            : followupEnd > until.getTime()
              ? 'collecting'
              : !started._min.occurredAt ||
                  started._min.occurredAt.getTime() > followup
                ? 'insufficient'
                : 'complete';
          return {
            week: cohort.week,
            registered: cohort.registered,
            returned: state === 'complete' ? cohort.returned : null,
            percent:
              state === 'complete'
                ? Math.round((cohort.returned / cohort.registered) * 1000) / 10
                : null,
            state,
          };
        }),
      },
    };
  }
}
