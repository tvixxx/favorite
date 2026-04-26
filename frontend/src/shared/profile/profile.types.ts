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
  totalMovies = "totalMovies",
  totalFavorites = "totalFavorites",
  totalSeeLater = "totalSeeLater",
  totalWatching = "totalWatching",
  totalCompleted = "totalCompleted",
  totalSerials = "totalSerials",
}

export interface StatsBlockItem {
  title: StatsBlockTitle;
  value: number;
  type: StatsBlockType;
}

export enum StatsBlockTitle {
  totalMovies = "В коллекции:",
  totalFavorites = "В избранном:",
  totalSeeLater = "Смотреть позже:",
  totalWatching = "Смотрю:",
  totalCompleted = "Просмотрено:",
  totalSerials = "Сериалов:",
}
