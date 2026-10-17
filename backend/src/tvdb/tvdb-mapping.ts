import { BadGatewayException } from '@nestjs/common';
import { ContentKind, Genre } from '../generated/prisma/enums';
import type { TvdbCandidate, TvdbPreview, TvdbType } from './tvdb.types';

const COUNTRIES = new Map<string, string>(
  'usa:US gbr:GB fra:FR deu:DE esp:ES ita:IT rus:RU ukr:UA pol:PL can:CA aus:AU jpn:JP kor:KR chn:CN ind:IN mex:MX bra:BR arg:AR tur:TR swe:SE nor:NO dnk:DK fin:FI nld:NL bel:BE che:CH aut:AT cze:CZ irl:IE nzl:NZ zaf:ZA are:AE isr:IL tha:TH vnm:VN phl:PH idn:ID hkg:HK twn:TW prt:PT grc:GR hun:HU hrv:HR isl:IS lux:LU mda:MD geo:GE arm:AM kaz:KZ blr:BY'
    .split(' ')
    .map((pair) => pair.split(':') as [string, string]),
);
const GENRES: Record<string, Genre> = {
  Action: Genre.ACTION,
  Adventure: Genre.ADVENTURE,
  'Awards Show': Genre.AWARDS_SHOW,
  Children: Genre.CHILDREN,
  Crime: Genre.CRIME,
  Food: Genre.FOOD,
  'Game Show': Genre.GAME_SHOW,
  History: Genre.HISTORY,
  'Home and Garden': Genre.HOME_AND_GARDEN,
  Indie: Genre.INDIE,
  'Martial Arts': Genre.MARTIAL_ARTS,
  'Mini-Series': Genre.MINI_SERIES,
  News: Genre.NEWS,
  Podcast: Genre.PODCAST,
  Reality: Genre.REALITY,
  Soap: Genre.SOAP,
  Sport: Genre.SPORT,
  Suspense: Genre.SUSPENSE,
  'Talk Show': Genre.TALK_SHOW,
  Travel: Genre.TRAVEL,
  Drama: Genre.DRAMA,
  Comedy: Genre.COMEDY,
  Mystery: Genre.DETECTIVE,
  Family: Genre.FAMILY,
  Fantasy: Genre.FANTASY,
  Horror: Genre.HORROR,
  Musical: Genre.MUSICAL,
  Romance: Genre.ROMANCE,
  Thriller: Genre.THRILLER,
  War: Genre.WAR,
  Western: Genre.WESTERN,
  Documentary: Genre.DOCUMENTARY,
  'Science Fiction': Genre.Sci_fi,
};

export function tvdbObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadGatewayException('Некорректный ответ TheTVDB');
  return value as Record<string, unknown>;
}
export function tvdbList(value: unknown): Record<string, unknown>[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value))
    throw new BadGatewayException('Некорректный список TheTVDB');
  return value.map(tvdbObject);
}
export function tvdbText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
export function tvdbIdText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}
export function isTvdbId(value: unknown): boolean {
  return (
    /^[1-9]\d{0,9}$/.test(tvdbIdText(value)) && Number(value) <= 2147483647
  );
}
export function tvdbPoster(value: unknown): string | null {
  try {
    const url = new URL(tvdbText(value));
    return url.protocol === 'https:' &&
      url.hostname === 'artworks.thetvdb.com' &&
      !url.username &&
      !url.password &&
      !url.port
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function plainText(value: unknown): string {
  return tvdbText(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
export function mapTvdbCandidate(value: unknown): TvdbCandidate | null {
  const row = tvdbObject(value);
  if (row.type !== 'movie' && row.type !== 'series') return null;
  const id = tvdbIdText(row.tvdb_id ?? row.id);
  if (!isTvdbId(id)) throw new BadGatewayException('Некорректный ID TheTVDB');
  const titles = row.translations ? tvdbObject(row.translations) : {};
  return {
    id,
    type: row.type,
    title: tvdbText(titles.rus),
    titleEn: tvdbText(titles.eng) || null,
    originalTitle: tvdbText(row.name),
    year: /^\d{4}$/.test(String(row.year)) ? Number(row.year) : null,
    aliases: Array.isArray(row.aliases)
      ? row.aliases
          .filter((v): v is string => typeof v === 'string')
          .slice(0, 50)
      : [],
    posterUrl: tvdbPoster(row.image_url ?? row.thumbnail),
  };
}
export function mapTvdbPreview(
  type: TvdbType,
  id: string,
  value: unknown,
  russian: unknown,
  english: unknown,
): TvdbPreview {
  const row = tvdbObject(value);
  if (String(row.id) !== id || !['movie', 'series'].includes(type))
    throw new BadGatewayException('Карточка TheTVDB не соответствует запросу');
  const ru = russian ? tvdbObject(russian) : {};
  const en = english ? tvdbObject(english) : {};
  const sourceGenres = tvdbList(row.genres)
    .map((g) => tvdbText(g.name))
    .filter(Boolean);
  const genres = [
    ...new Set(sourceGenres.map((g) => GENRES[g]).filter(Boolean)),
  ];
  const contentKind = sourceGenres.includes('Anime')
    ? ContentKind.ANIME
    : sourceGenres.includes('Animation')
      ? ContentKind.ANIMATION
      : sourceGenres.some((g) =>
            ['Reality', 'Game Show', 'Talk Show'].includes(g),
          )
        ? ContentKind.TV_SHOW
        : ContentKind.GENERAL;
  const actors = new Map<string, { id: string; name: string }>();
  const order = (person: Record<string, unknown>): number =>
    typeof person.sort === 'number' &&
    Number.isSafeInteger(person.sort) &&
    person.sort >= 0
      ? person.sort
      : Number.MAX_SAFE_INTEGER;
  const people = tvdbList(row.characters).sort(
    (a, b) =>
      Number(b.isFeatured === true) - Number(a.isFeatured === true) ||
      order(a) - order(b),
  );
  for (const person of people) {
    const actorId = tvdbIdText(person.peopleId);
    const name = tvdbText(person.personName);
    if (
      person.peopleType === 'Actor' &&
      isTvdbId(actorId) &&
      !actors.has(actorId) &&
      name &&
      name.length <= 200
    )
      actors.set(actorId, { id: actorId, name });
  }
  const aliases = tvdbList(row.aliases).map((a) => tvdbText(a.name));
  const countryCodes = [
    ...new Set(
      [
        ...tvdbList(row.production_countries).map((c) =>
          COUNTRIES.get(tvdbText(c.country).toLowerCase()),
        ),
        COUNTRIES.get(tvdbText(row.originalCountry).toLowerCase()),
      ].filter((code): code is string => Boolean(code)),
    ),
  ];
  return {
    id,
    type,
    title: tvdbText(ru.name),
    titleEn: tvdbText(en.name) || null,
    originalTitle: tvdbText(row.name),
    aliases: [...new Set(aliases.filter(Boolean))],
    year: /^\d{4}$/.test(String(row.year)) ? Number(row.year) : null,
    posterUrl: tvdbPoster(row.image),
    description: plainText(ru.overview) || plainText(en.overview),
    descriptionLanguage: plainText(ru.overview) ? 'ru' : 'en',
    countryCodes,
    genres,
    unmappedGenres: sourceGenres.filter(
      (g) => !GENRES[g] && !['Anime', 'Animation'].includes(g),
    ),
    contentKind,
    isSerial: type === 'series',
    actors: [...actors.values()].slice(0, 200),
    seasonCount: null,
    episodeCount: null,
  };
}
