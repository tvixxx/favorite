export type SettingBlockType = "theme" | "stats";

export interface SettingBlockProps {
  type: SettingBlockType;
  title: string;
  description: string;
  icon: string;
}

export interface StatsBlock {
  items: StatsBlockItem[] | null;
}

export enum StatsBlockType {
  allMovies = "allMovies",
  allFavorites = "allFavorites",
  allSerials = "allSerials",
  allSeeLater = "allSeeLater",
}

export interface StatsBlockItem {
  title: StatsBlockTitle;
  value: number;
  type: StatsBlockType;
}

export enum StatsBlockTitle {
  allMovies = "Все фильмы:",
  allFavorites = "В избранном:",
  allSerials = "Все сериалы:",
  allSeeLater = "Смотреть позже:",
}
