import { SettingBlockProps, StatsBlockTitle, StatsBlockType } from "@/shared";

export const SETTING_BLOCKS: SettingBlockProps[] = [
  {
    type: "theme",
    title: "Цветовая тема",
    description: "Выберите тему, которая вам больше нравится",
    icon: "mdi:theme-light-dark",
  },
  {
    type: "stats",
    title: "Статистика",
    description: "Информация по фильмам и сериалам",
    icon: "mdi:information-slab-symbol",
  },
  {
    type: "friends",
    title: "Друзья",
    description: "Управление друзьями и подписками",
    icon: "mdi:account-group",
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
