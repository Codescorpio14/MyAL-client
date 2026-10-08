import { textOf } from '@/api/html';
import { encodeQuery, fetchJson, fetchText, RequestGate, withRetries } from '@/api/http';

/**
 * Search sources the original hits outside of Tenrai:
 *
 *  - `EverywhereSearchQuery` → `myanimelist.net/search/prefix.json?type=all|user`
 *    (JSON, categories: anime/manga/character/person/user; the user category is
 *    re-fetched separately and trimmed to the 5 best `es_score` entries).
 *  - `CharactersSearchQuery` → `myanimelist.net/character.php?q=` (HtmlAgilityPack
 *    scrape of the first `<table>`, ported here with regex + the shared html.ts
 *    text helpers).
 *
 * Anime/Manga search itself goes through `@/api/tenrai` (`AnimeSearchQuery` /
 * `MangaSearchQuery` already use TenraiClient).
 */

const MAL_BASE = 'https://myanimelist.net';

/** Same cadence as `scrape.ts` (MAL site, not the Tenrai gate). */
const gate = new RequestGate(150);

function malUrl(path: string, params: Record<string, string | number | undefined>): string {
  return `${MAL_BASE}/${path}${encodeQuery(params)}`;
}

function malJson<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = malUrl(path, params);
  return gate.run(() =>
    withRetries(
      () =>
        fetchJson<T>(url, {
          headers: { 'User-Agent': 'MALClient/3.0', Accept: 'application/json' },
        }),
      3
    )
  );
}

function malHtml(path: string, params: Record<string, string | number | undefined>): Promise<string> {
  const url = malUrl(path, params);
  return gate.run(() =>
    withRetries(() => fetchText(url, { headers: { 'User-Agent': 'MALClient/3.0' } }), 3)
  );
}

/* ------------------------------ everywhere ----------------------------- */

/** `Payload` from `SearchEverywhereResponse.cs`. */
export interface EverywherePayload {
  media_type?: string;
  start_year?: number;
  /** Already stripped at 'T' by the original `SanitizeDate`. */
  aired?: string;
  published?: string;
  score?: string;
  status?: string;
  related_works?: string[];
  favorites?: number;
  birthday?: string;
  alternative_name?: string;
}

/** `Item` from `SearchEverywhereResponse.cs`. */
export interface EverywhereItem {
  id: number;
  type?: string;
  name: string;
  url?: string;
  image_url?: string;
  thumbnail_url?: string;
  payload?: EverywherePayload;
  es_score?: number;
}

/** One `Category` (anime/manga/character/person/user), items sorted by es_score desc. */
export interface EverywhereGroup {
  type: string;
  items: EverywhereItem[];
}

interface PrefixCategory {
  type?: string;
  items?: EverywhereItem[] | null;
}

interface PrefixResponse {
  categories?: PrefixCategory[] | null;
}

function toGroup(category: PrefixCategory | undefined): EverywhereGroup | undefined {
  if (!category) return undefined;
  const items = [...(category.items ?? [])]
    .filter((item) => item && typeof item.id === 'number')
    .sort((a, b) => (b.es_score ?? 0) - (a.es_score ?? 0));
  if (!items.length) return undefined;
  return { type: (category.type ?? '').toLowerCase(), items };
}

/** Port of `EverywhereSearchQuery.GetResult` — all-categories + top-5 users. */
export async function searchEverywhere(query: string): Promise<EverywhereGroup[]> {
  const keyword = query.trim();
  const all = await malJson<PrefixResponse>('search/prefix.json', { type: 'all', keyword, v: 1 });
  const users = await malJson<PrefixResponse>('search/prefix.json', { type: 'user', keyword, v: 1 });

  const groups: EverywhereGroup[] = [];
  for (const category of all.categories ?? []) {
    const group = toGroup(category);
    if (group) groups.push(group);
  }

  // The original takes `userResponse.Categories[0]` ordered by es_score, top 5.
  const userCategory = (users.categories ?? [])[0];
  const userGroup = toGroup(
    userCategory ? { ...userCategory, items: (userCategory.items ?? []).slice(0, 5) } : undefined
  );
  if (userGroup) groups.push({ ...userGroup, type: 'user' });

  return groups;
}

/** 'anime' → 'Anime', 'user' → 'User' (char.ToUpper + Substring). */
export function capitalizeCategory(type: string): string {
  if (!type) return type;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Payload dates may carry a time component — original `SanitizeDate`. */
export function sanitizeDate(value: string | undefined): string {
  if (!value) return '';
  const tIndex = value.indexOf('T');
  return tIndex > 0 ? value.slice(0, tIndex) : value;
}

/* ------------------------------ characters ----------------------------- */

/** `AnimeCharacter` subset shown by the character search grid. */
export interface CharacterSearchItem {
  id: number;
  name: string;
  imageUrl?: string;
  /** The `<small>` under the name, e.g. "(Nine-Tails Jinchuuriki)". */
  notes?: string;
}

function stripCdnResize(url: string): string | undefined {
  if (url.includes('questionmark')) return undefined;
  // `/r/42x62/images/...` → `/images/...`, then drop the cache-busting query.
  const withoutResize = url.replace(/\/r\/\d+x\d+/, '');
  const q = withoutResize.indexOf('?');
  const cleaned = q === -1 ? withoutResize : withoutResize.slice(0, q);
  return cleaned || undefined;
}

/** Port of `CharactersSearchQuery.GetSearchResults`. */
export async function searchCharacters(query: string): Promise<CharacterSearchItem[]> {
  const html = await malHtml('character.php', { q: query.trim() });

  const output: CharacterSearchItem[] = [];
  const tableStart = html.indexOf('<table');
  if (tableStart === -1) return output;
  const tableEnd = html.indexOf('</table>', tableStart);
  const table = html.slice(tableStart, tableEnd === -1 ? undefined : tableEnd);

  const rows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    // tds[0] = portrait cell, tds[1] = name cell (HtmlAgilityPack parity).
    const cells = row.split(/<td\b/i);
    if (cells.length < 3) continue;
    const portraitCell = cells[1];
    const nameCell = cells[2];

    const anchor = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(nameCell);
    if (!anchor) continue;
    const name = textOf(anchor[1]);
    const id = /\/character\/(\d+)/.exec(anchor[0]) ?? /\/character\/(\d+)/.exec(cells[1]);
    if (!name || !id) continue;

    const img = /<img\b[^>]*>/i.exec(portraitCell)?.[0] ?? '';
    const src = /\bdata-src\s*=\s*"([^"]+)"/i.exec(img)?.[1] ?? /\bsrc\s*=\s*"([^"]+)"/i.exec(img)?.[1];

    const smalls = nameCell.match(/<small\b[^>]*>[\s\S]*?<\/small>/gi);
    const notes = smalls?.length ? textOf(smalls[smalls.length - 1]) : undefined;

    output.push({
      id: parseInt(id[1], 10),
      name,
      imageUrl: src ? stripCdnResize(src) : undefined,
      notes: notes || undefined,
    });
  }
  return output;
}

/* -------------------------------- Jikan -------------------------------- */

/** Jikan/Tenrai search hit — the subset the search rows render. */
export interface JikanSearchItem {
  mal_id: number;
  title?: string;
  images?: { jpg?: { image_url?: string; large_image_url?: string } };
  type?: string;
  episodes?: number | null;
  chapters?: number | null;
  score?: number | null;
  status?: string;
  synopsis?: string | null;
  year?: number | null;
  genres?: { mal_id: number; name: string }[];
  aired?: { from?: string | null };
  published?: { from?: string | null };
}
