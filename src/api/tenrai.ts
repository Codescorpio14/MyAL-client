import { encodeQuery, fetchJson, RequestGate, withRetries } from '@/api/http';

/**
 * Tenrai API — `https://api.tenrai.org/v1` (Jikan-shaped JSON).
 * Ports `MALClient.XShared/Comm/TenraiClient.cs`:
 *  - `MALClient/3.0` user agent
 *  - minimum 500ms between requests
 *  - 4 retries, honours 429/5xx backoff
 */
const BASE = 'https://api.tenrai.org/v1';

const gate = new RequestGate(500);

export interface TenraiPagination {
  has_next_page?: boolean;
  current_page?: number;
  last_visible_page?: number;
  items?: { count?: number; total?: number; per_page?: number };
}

export interface TenraiResponse<T> {
  data: T;
  pagination?: TenraiPagination;
}

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<TenraiResponse<T>> {
  const url = `${BASE}${path}${encodeQuery(params)}`;
  return gate.run(() =>
    withRetries(
      () =>
        fetchJson<TenraiResponse<T>>(url, {
          headers: { 'User-Agent': 'MALClient/3.0', Accept: 'application/json' },
        }),
      4
    )
  );
}

/* ----------------------------- search ----------------------------- */

export function searchAnime(query: string, page = 1) {
  return get<unknown[]>('/anime', { q: query, sfw: 'true', page });
}

export function searchManga(query: string, page = 1) {
  return get<unknown[]>('/manga', { q: query, sfw: 'true', page });
}

export function animeByGenre(genreId: number, page = 1) {
  return get<unknown[]>('/anime', { genres: genreId, page, order_by: 'score', sort: 'desc' });
}

export function animeByStudio(studioId: number, page = 1) {
  return get<unknown[]>('/anime', { producers: studioId, page, order_by: 'score', sort: 'desc' });
}

/* ----------------------------- seasons ---------------------------- */

export interface SeasonEntry {
  year: number;
  season: string;
}

export function seasons() {
  return get<SeasonEntry[]>('/seasons');
}

export function season(year: number, seasonName: string, page = 1) {
  return get<unknown[]>(`/seasons/${year}/${seasonName}`, { page });
}

/* ----------------------------- details ---------------------------- */

export function animeDetails(id: number) {
  return get<Record<string, unknown>>(`/anime/${id}`);
}

export function mangaDetails(id: number) {
  return get<Record<string, unknown>>(`/manga/${id}`);
}

export function animeThemes(id: number) {
  return get<{ data?: { themes?: { mal_id: number; name: string }[] } }>(`/anime/${id}/themes`);
}

export function animeEpisodes(id: number, page = 1) {
  return get<{ mal_id: number; title: string; episode: string; aired: string; filler?: boolean; recap?: boolean }[]>(
    `/anime/${id}/episodes`,
    { page }
  );
}

export function reviews(kind: 'anime' | 'manga', id: number, page = 1) {
  return get<Record<string, unknown>[]>(`/${kind}/${id}/reviews`, { page });
}

export function recommendations(kind: 'anime' | 'manga', id: number) {
  return get<Record<string, unknown>[]>(`/${kind}/${id}/recommendations`);
}

export function characters(kind: 'anime' | 'manga', id: number) {
  return get<Record<string, unknown>[]>(`/${kind}/${id}/characters`);
}

export function relations(kind: 'anime' | 'manga', id: number) {
  return get<{ data?: { relation?: string; entry?: { mal_id: number; type: string; name: string }[] }[] }>(
    `/${kind}/${id}/relations`
  );
}

/* ------------------------- profile / social ----------------------- */

export function userFavorites(username: string) {
  return get<Record<string, unknown>>(`/users/${encodeURIComponent(username)}/favorites`);
}

export function userFriends(username: string, page = 1) {
  return get<Record<string, unknown>[]>(`/users/${encodeURIComponent(username)}/friends`, { page });
}
