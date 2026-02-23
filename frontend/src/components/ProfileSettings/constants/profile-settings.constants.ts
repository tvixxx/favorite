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
];

export const STAT_BLOCK_TITLES: Record<StatsBlockType, StatsBlockTitle> = {
  [StatsBlockType.allMovies]: StatsBlockTitle.allMovies,
  [StatsBlockType.allFavorites]: StatsBlockTitle.allFavorites,
  [StatsBlockType.allSerials]: StatsBlockTitle.allSerials,
  [StatsBlockType.allSeeLater]: StatsBlockTitle.allSeeLater,
};
