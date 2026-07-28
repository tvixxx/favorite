import type { RouteLocationNormalizedLoaded } from "vue-router";

export interface LeaderboardHeroMeta {
  title: string;
  subtitle: string;
  badgeText: string;
  iconName: string;
  kind: "users" | "movies";
}

// Эталон: раздел различается сегментом, поэтому шапка у обеих вкладок одна —
// eyebrow «Рейтинг», короткий заголовок «Топ», один подзаголовок
const LEADERBOARD_HERO_BASE = {
  title: "Топ",
  subtitle: "Лучшие киноманы и фильмы сообщества",
  badgeText: "Рейтинг",
  iconName: "ph:trophy-fill",
} as const;

export const LEADERBOARD_HERO_USERS: LeaderboardHeroMeta = {
  ...LEADERBOARD_HERO_BASE,
  kind: "users",
};

export const LEADERBOARD_HERO_MOVIES: LeaderboardHeroMeta = {
  ...LEADERBOARD_HERO_BASE,
  kind: "movies",
};

export function getLeaderboardHeroMeta(
  route: RouteLocationNormalizedLoaded,
): LeaderboardHeroMeta | undefined {
  const raw = route.meta.leaderboardHero;
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  return raw as LeaderboardHeroMeta;
}
