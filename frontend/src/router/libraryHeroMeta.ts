export interface LibraryHeroMeta {
  title: string;
  subtitle: string;
  badgeText: string;
  iconName: string;
}

export const LIBRARY_HERO_COLLECTION: LibraryHeroMeta = {
  title: "Кинотеатр у вас дома",
  subtitle: "Все хиты и новинки которые вы смотрели",
  badgeText: "Фильмотека",
  iconName: "mdi:filmstrip",
};

export const LIBRARY_HERO_CATALOG: LibraryHeroMeta = {
  title: "Общий каталог",
  subtitle:
    "Все фильмы и сериалы в приложении — добавляйте понравившееся к себе",
  badgeText: "Каталог",
  iconName: "mdi:movie-search",
};

export const LIBRARY_HERO_ACTORS: LibraryHeroMeta = {
  title: "Актёры",
  subtitle:
    "Выберите актёра, чтобы открыть его фильмы и сериалы из общего каталога",
  badgeText: "В списке",
  iconName: "mdi:account-group",
};

export const LIBRARY_HERO_LISTS: LibraryHeroMeta = {
  title: "Мои списки",
  subtitle:
    "Подборки под настроение и сценарии просмотра: открывайте список и управляйте его содержимым",
  badgeText: "Списков",
  iconName: "mdi:playlist-star",
};
