import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserMovieService } from '../user-movie/user-movie.service';

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category:
    | 'movies'
    | 'favorites'
    | 'completed'
    | 'serials'
    | 'ratings'
    | 'time';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  isUnlocked: boolean;
  progress?: number;
  requirement: number;
  currentValue: number;
}

export type LeaderboardBadgePreview = Pick<
  Badge,
  'id' | 'title' | 'icon' | 'tier' | 'category'
>;

interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: Badge['category'];
  tier: Badge['tier'];
  requirement: number;
  getValue: (stats: any, timeStats: any) => number;
}

@Injectable()
export class BadgeService {
  private readonly badgeDefinitions: BadgeDefinition[] = [
    // Просмотры
    {
      id: 'first-steps',
      title: 'Первые шаги',
      description: 'Добавьте свой первый фильм',
      icon: '🎬',
      category: 'movies',
      tier: 'bronze',
      requirement: 1,
      getValue: (stats) => stats.totalMovies,
    },
    {
      id: 'movie-fan',
      title: 'Киноман',
      description: 'Добавьте 10 фильмов в коллекцию',
      icon: '🍿',
      category: 'movies',
      tier: 'silver',
      requirement: 10,
      getValue: (stats) => stats.totalMovies,
    },
    {
      id: 'cinema-legend',
      title: 'Легенда кино',
      description: 'Добавьте 50 фильмов в коллекцию',
      icon: '🎭',
      category: 'movies',
      tier: 'gold',
      requirement: 50,
      getValue: (stats) => stats.totalMovies,
    },
    {
      id: 'marathon-master',
      title: 'Мастер марафонов',
      description: 'Добавьте 100 фильмов в коллекцию',
      icon: '🏆',
      category: 'movies',
      tier: 'platinum',
      requirement: 100,
      getValue: (stats) => stats.totalMovies,
    },

    // Избранное
    {
      id: 'collector',
      title: 'Коллекционер',
      description: 'Добавьте 5 фильмов в избранное',
      icon: '⭐',
      category: 'favorites',
      tier: 'bronze',
      requirement: 5,
      getValue: (stats) => stats.totalFavorites,
    },
    {
      id: 'curator',
      title: 'Куратор',
      description: 'Добавьте 20 фильмов в избранное',
      icon: '🌟',
      category: 'favorites',
      tier: 'gold',
      requirement: 20,
      getValue: (stats) => stats.totalFavorites,
    },

    // Завершённые
    {
      id: 'finisher',
      title: 'Финишёр',
      description: 'Завершите просмотр 10 фильмов',
      icon: '✅',
      category: 'completed',
      tier: 'silver',
      requirement: 10,
      getValue: (stats) => stats.totalCompleted,
    },
    {
      id: 'marathoner',
      title: 'Марафонец',
      description: 'Завершите просмотр 50 фильмов',
      icon: '🎯',
      category: 'completed',
      tier: 'gold',
      requirement: 50,
      getValue: (stats) => stats.totalCompleted,
    },

    // Сериалы
    {
      id: 'series-fan',
      title: 'Сериаломан',
      description: 'Добавьте 5 сериалов',
      icon: '📺',
      category: 'serials',
      tier: 'bronze',
      requirement: 5,
      getValue: (stats) => stats.totalSerials,
    },
    {
      id: 'series-king',
      title: 'Король сериалов',
      description: 'Добавьте 20 сериалов',
      icon: '👑',
      category: 'serials',
      tier: 'gold',
      requirement: 20,
      getValue: (stats) => stats.totalSerials,
    },

    // Оценки
    {
      id: 'critic',
      title: 'Критик',
      description: 'Оцените 10 фильмов',
      icon: '📝',
      category: 'ratings',
      tier: 'silver',
      requirement: 10,
      getValue: (stats) => stats.totalRated,
    },
    {
      id: 'chief-critic',
      title: 'Главный критик',
      description: 'Оцените 50 фильмов',
      icon: '🎓',
      category: 'ratings',
      tier: 'gold',
      requirement: 50,
      getValue: (stats) => stats.totalRated,
    },

    // Временные
    {
      id: 'weekly-marathon',
      title: 'Недельный марафон',
      description: 'Добавьте 10+ фильмов за последние 7 дней',
      icon: '🔥',
      category: 'time',
      tier: 'silver',
      requirement: 10,
      getValue: (stats, timeStats) => timeStats.weekCount,
    },
    {
      id: 'monthly-record',
      title: 'Месячный рекорд',
      description: 'Добавьте 30+ фильмов за последний месяц',
      icon: '💎',
      category: 'time',
      tier: 'platinum',
      requirement: 30,
      getValue: (stats, timeStats) => timeStats.monthCount,
    },
  ];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly userMovieService: UserMovieService,
  ) {}

  async getUserBadges(userId: string): Promise<Badge[]> {
    const stats = await this.userMovieService.getUserStats(userId);
    const timeStats = await this.getTimeBasedStats(userId);
    const ratedCount = await this.getRatedCount(userId);

    const extendedStats = {
      ...stats,
      totalRated: ratedCount,
    };

    return this.calculateBadges(extendedStats, timeStats);
  }

  async getTopUnlockedBadges(
    userId: string,
    limit = 6,
  ): Promise<LeaderboardBadgePreview[]> {
    const tierRank: Record<Badge['tier'], number> = {
      platinum: 4,
      gold: 3,
      silver: 2,
      bronze: 1,
    };

    const badges = await this.getUserBadges(userId);

    return badges
      .filter((b) => b.isUnlocked)
      .sort((a, b) => {
        const tr = tierRank[b.tier] - tierRank[a.tier];
        if (tr !== 0) {
          return tr;
        }
        return b.requirement - a.requirement;
      })
      .slice(0, limit)
      .map(({ id, title, icon, tier, category }) => ({
        id,
        title,
        icon,
        tier,
        category,
      }));
  }

  private async getTimeBasedStats(userId: string) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [weekCount, monthCount] = await Promise.all([
      this.prismaService.userMovie.count({
        where: { userId, addedAt: { gte: weekAgo } },
      }),
      this.prismaService.userMovie.count({
        where: { userId, addedAt: { gte: monthAgo } },
      }),
    ]);

    return { weekCount, monthCount };
  }

  private async getRatedCount(userId: string): Promise<number> {
    return this.prismaService.userMovie.count({
      where: {
        userId,
        personalRate: {
          not: null,
        },
      },
    });
  }

  private calculateBadges(stats: any, timeStats: any): Badge[] {
    return this.badgeDefinitions.map((def) => {
      const currentValue = def.getValue(stats, timeStats);
      const isUnlocked = currentValue >= def.requirement;
      const progress = isUnlocked
        ? 100
        : Math.floor((currentValue / def.requirement) * 100);

      return {
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        category: def.category,
        tier: def.tier,
        isUnlocked,
        progress,
        requirement: def.requirement,
        currentValue,
      };
    });
  }
}
