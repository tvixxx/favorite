/** ISO 3166-1 alpha-2 — подписи на русском для UI (единый источник для автокомплита). */
export interface ProductionCountryOption {
  code: string;
  label: string;
}

export const PRODUCTION_COUNTRIES: ProductionCountryOption[] = [
  { code: "US", label: "США" },
  { code: "GB", label: "Великобритания" },
  { code: "FR", label: "Франция" },
  { code: "DE", label: "Германия" },
  { code: "ES", label: "Испания" },
  { code: "IT", label: "Италия" },
  { code: "RU", label: "Россия" },
  { code: "UA", label: "Украина" },
  { code: "PL", label: "Польша" },
  { code: "CA", label: "Канада" },
  { code: "AU", label: "Австралия" },
  { code: "JP", label: "Япония" },
  { code: "KR", label: "Южная Корея" },
  { code: "CN", label: "Китай" },
  { code: "IN", label: "Индия" },
  { code: "MX", label: "Мексика" },
  { code: "BR", label: "Бразилия" },
  { code: "AR", label: "Аргентина" },
  { code: "TR", label: "Турция" },
  { code: "SE", label: "Швеция" },
  { code: "NO", label: "Норвегия" },
  { code: "DK", label: "Дания" },
  { code: "FI", label: "Финляндия" },
  { code: "NL", label: "Нидерланды" },
  { code: "BE", label: "Бельгия" },
  { code: "CH", label: "Швейцария" },
  { code: "AT", label: "Австрия" },
  { code: "CZ", label: "Чехия" },
  { code: "IE", label: "Ирландия" },
  { code: "NZ", label: "Новая Зеландия" },
  { code: "ZA", label: "ЮАР" },
  { code: "AE", label: "ОАЭ" },
  { code: "IL", label: "Израиль" },
  { code: "TH", label: "Таиланд" },
  { code: "VN", label: "Вьетнам" },
  { code: "PH", label: "Филиппины" },
  { code: "ID", label: "Индонезия" },
  { code: "HK", label: "Гонконг" },
  { code: "TW", label: "Тайвань" },
  { code: "PT", label: "Португалия" },
  { code: "GR", label: "Греция" },
  { code: "HU", label: "Венгрия" },
  { code: "HR", label: "Хорватия" },
  { code: "IS", label: "Исландия" },
  { code: "LU", label: "Люксембург" },
  { code: "MD", label: "Молдова" },
  { code: "GE", label: "Грузия" },
  { code: "AM", label: "Армения" },
  { code: "KZ", label: "Казахстан" },
  { code: "BY", label: "Беларусь" },
];

export const PRODUCTION_COUNTRY_CODES = PRODUCTION_COUNTRIES.map((c) => c.code);

export const countryLabelRu = (code: string): string =>
  PRODUCTION_COUNTRIES.find((c) => c.code === code)?.label ?? code;

export const countriesLabelsRu = (codes: string[] | undefined): string =>
  (codes?.length ? codes : []).map(countryLabelRu).join(", ");
