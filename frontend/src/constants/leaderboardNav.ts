export const LEADERBOARD_PATHS = {
  users: "/leaderboard/users",
  movies: "/leaderboard/movies",
} as const;

export type LeaderboardNavItem = {
  to: string;
  label: string;
};

export const LEADERBOARD_NAV_ITEMS: LeaderboardNavItem[] = [
  { to: LEADERBOARD_PATHS.users, label: "Топ пользователей" },
  { to: LEADERBOARD_PATHS.movies, label: "Топ фильмов и сериалов" },
];
