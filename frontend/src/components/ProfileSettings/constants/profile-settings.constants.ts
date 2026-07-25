import { SettingBlockProps, StatsBlockTitle, StatsBlockType } from "@/shared";

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
    description: "Управление друзьями и подписками",
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
