import { SettingBlockProps, StatsBlockTitle, StatsBlockType } from "@/shared";
import type { Theme } from "@/composable/useTheme";

export const PROFILE_THEME_META: Record<
  Theme,
  { label: string; canvas: string; accent: string }
> = {
  light: { label: "Светлая", canvas: "#ffffff", accent: "#ff0032" },
  dark: { label: "Тёмная", canvas: "#141414", accent: "#177ddc" },
  emerald: { label: "Изумруд", canvas: "#f0fdf4", accent: "#10b981" },
  corporate: { label: "Деловая", canvas: "#f8fafc", accent: "#1e40af" },
  synthwave: { label: "Synthwave", canvas: "#1e1e3f", accent: "#ec4899" },
  retro: { label: "Ретро", canvas: "#fef3c7", accent: "#f59e0b" },
  cyberpunk: { label: "Cyberpunk", canvas: "#1e1b4b", accent: "#8b5cf6" },
};

export const SETTING_BLOCKS: SettingBlockProps[] = [
  {
    type: "theme",
    title: "Цветовая тема",
    description: "Выберите тему, которая вам больше нравится",
    icon: "ph:palette",
  },
  {
    type: "stats",
    title: "Статистика",
    description: "",
    icon: "ph:chart-bar",
  },
  {
    type: "friends",
    title: "Друзья",
    description: "",
    icon: "ph:users-three",
  },
];

export const STAT_BLOCK_TITLES: Record<StatsBlockType, StatsBlockTitle> = {
  [StatsBlockType.totalMovies]: StatsBlockTitle.totalMovies,
  [StatsBlockType.totalFavorites]: StatsBlockTitle.totalFavorites,
  [StatsBlockType.totalSeeLater]: StatsBlockTitle.totalSeeLater,
  [StatsBlockType.totalWatching]: StatsBlockTitle.totalWatching,
  [StatsBlockType.totalCompleted]: StatsBlockTitle.totalCompleted,
  [StatsBlockType.totalSerials]: StatsBlockTitle.totalSerials,
};
