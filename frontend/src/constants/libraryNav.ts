export interface LibraryNavItem {
  to: string;
  label: string;
}

export const LIBRARY_NAV_ITEMS: LibraryNavItem[] = [
  { to: "/library/collection", label: "Моя коллекция" },
  { to: "/library/catalog", label: "Каталог" },
  { to: "/library/actors", label: "Актёры" },
  { to: "/library/lists", label: "Мои списки" },
];
