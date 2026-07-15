export interface LibraryHeroMeta {
  title: string;
  subtitle: string;
  badgeText: string;
  iconName: string;
}

export const LIBRARY_HERO_COLLECTION: LibraryHeroMeta = {
  title: "Моя коллекция",
  subtitle: "продолжайте смотреть с того места, где остановились",
  badgeText: "Медиатека",
  iconName: "ph:squares-four",
};

export const LIBRARY_HERO_CATALOG: LibraryHeroMeta = {
  title: "Каталог",
  subtitle: "Найдите новое кино и добавьте в свою коллекцию",
  badgeText: "Медиатека",
  iconName: "ph:magnifying-glass",
};

export const LIBRARY_HERO_ACTORS: LibraryHeroMeta = {
  title: "Актёры",
  subtitle:
    "Выберите актёра, чтобы открыть его фильмы и сериалы из общего каталога",
  badgeText: "Медиатека",
  iconName: "ph:users-three",
};

export const LIBRARY_HERO_LISTS: LibraryHeroMeta = {
  title: "Мои списки",
  subtitle:
    "Подборки под настроение и сценарии просмотра: открывайте список и управляйте его содержимым",
  badgeText: "Медиатека",
  iconName: "ph:bookmarks-simple",
};
