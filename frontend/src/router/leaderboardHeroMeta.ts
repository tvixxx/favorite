import type { RouteLocationNormalizedLoaded } from "vue-router";

export interface LeaderboardHeroMeta {
  title: string;
  subtitle: string;
  badgeText: string;
  iconName: string;
  kind: "users" | "movies";
}

export const LEADERBOARD_HERO_USERS: LeaderboardHeroMeta = {
  title: "Топ пользователей",
  subtitle:
    "Кто больше всего смотрит до конца: фильмы сразу в зачёт, сериалы — только после последней серии",
  badgeText: "Участников",
  iconName: "mdi:podium-gold",
  kind: "users",
};

export const LEADERBOARD_HERO_MOVIES: LeaderboardHeroMeta = {
  title: "Топ фильмов и сериалов",
  subtitle:
    "Средняя пользовательская оценка из коллекций; без оценок считается 0 и попадает в диапазон, если в фильтре рейтинга есть 0",
  badgeText: "В списке",
  iconName: "mdi:star-circle",
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
