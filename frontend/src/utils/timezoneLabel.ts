const cities: Record<string, string> = {
  "Europe/Kaliningrad": "Калининград",
  "Europe/Moscow": "Москва",
  "Europe/Volgograd": "Волгоград",
  "Europe/Samara": "Самара",
  "Europe/Saratov": "Саратов",
  "Europe/Astrakhan": "Астрахань",
  "Europe/Ulyanovsk": "Ульяновск",
  "Asia/Yekaterinburg": "Екатеринбург",
  "Asia/Omsk": "Омск",
  "Asia/Novosibirsk": "Новосибирск",
  "Asia/Krasnoyarsk": "Красноярск",
  "Asia/Irkutsk": "Иркутск",
  "Asia/Yakutsk": "Якутск",
  "Asia/Vladivostok": "Владивосток, Хабаровск",
  "Asia/Magadan": "Магадан",
  "Asia/Sakhalin": "Сахалин",
  "Asia/Kamchatka": "Камчатка",
  "Asia/Anadyr": "Анадырь",
  "Europe/Berlin": "Берлин",
  "Europe/London": "Лондон",
  "Asia/Almaty": "Алматы",
  "Asia/Tokyo": "Токио",
};

export function timezoneLabel(zone: string, date = new Date()): string {
  try {
    const offset = new Intl.DateTimeFormat("en", {
      timeZone: zone,
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;
    const utc =
      !offset || offset === "GMT" ? "UTC+00:00" : offset.replace("GMT", "UTC");

    return zone === "UTC"
      ? utc
      : `${cities[zone] ?? zone.replaceAll("_", " ")} (${utc})`;
  } catch {
    return zone;
  }
}
