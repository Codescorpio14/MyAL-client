import NetInfo from '@react-native-community/netinfo';

import { cachedQuery, cacheGet, cacheSet, clearCache } from '@/api/cache';
import { getAuth } from '@/api/auth';
import { fetchLibrary, fetchSeasonal, updateListStatus, removeListStatus, ListStatusUpdate } from '@/api/mal';
import * as scrape from '@/api/scrape';
import * as tenrai from '@/api/tenrai';
import {
  LibraryItem,
  ListKind,
  MangaAdaptedType,
  MangaTopType,
  SortOption,
  StatusKey,
  TopAnimeType,
  WorkMode,
} from '@/api/types';

/**
 * Ports `AnimeLibraryDataStorage` + `AnimeListViewModel` data plumbing:
 * cache-first loading per work mode, sorting/filtering, list updates with an
 * offline retry queue (`Settings.AnimeSyncRequired` / `MangaSyncRequired`).
 */

const LIST_CACHE_DAYS = 3;
const SEASONAL_CACHE_DAYS = 1;

/** Current season — mirrors `AnimeSeason.Current`. */
export function currentSeason(): { year: number; season: 'winter' | 'spring' | 'summer' | 'fall'; name: string } {
  const month = new Date().getMonth(); // 0-11
  const year = new Date().getFullYear();
  if (month <= 2) return { year, season: 'winter', name: 'winter' };
  if (month <= 5) return { year, season: 'spring', name: 'spring' };
  if (month <= 8) return { year, season: 'summer', name: 'summer' };
  return { year, season: 'fall', name: 'fall' };
}

export interface ListQuery {
  workMode: WorkMode;
  kind: ListKind;
  /** Status filter index used by the right drawer (null = all). */
  statusFilter?: StatusKey | null;
  topAnimeType?: TopAnimeType;
  topMangaType?: MangaTopType;
  adaptedType?: MangaAdaptedType;
  genreId?: number;
  studioId?: number;
  seasonYear?: number;
  seasonName?: 'winter' | 'spring' | 'summer' | 'fall';
  force?: boolean;
}

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/** Loads (cache-first) the items for a work mode. */
export async function loadList(query: ListQuery): Promise<LibraryItem[]> {
  const online = await isOnline();
  const user = getAuth().username || 'me';

  switch (query.workMode) {
    case 'Anime':
    case 'Manga': {
      const kind = query.workMode === 'Anime' ? 'anime' : 'manga';
      return cachedQuery(
        'api',
        `library_${kind}_${user}`,
        async () => {
          const all: LibraryItem[] = [];
          let offset = 0;
          for (;;) {
            const page: Awaited<ReturnType<typeof fetchLibrary>> = await fetchLibrary(kind, user, offset);
            all.push(...page.items);
            if (!page.hasNext || page.nextOffset === undefined) break;
            offset = page.nextOffset;
          }
          return all;
        },
        { ttlDays: LIST_CACHE_DAYS, force: query.force, staleWhenOffline: true }
      );
    }

    case 'SeasonalAnime': {
      const year = query.seasonYear ?? currentSeason().year;
      const seasonName = query.seasonName ?? currentSeason().season;
      const auth = getAuth();
      return cachedQuery(
        'api',
        `seasonal_v3_${auth.username || 'public'}_${year}_${seasonName}`,
        async () => {
          const all: LibraryItem[] = [];
          let offset = 0;
          for (;;) {
            const page = await fetchSeasonal(year, seasonName, offset);
            all.push(...page.items);
            if (!page.hasNext || page.nextOffset === undefined) break;
            offset = page.nextOffset;
            if (all.length >= 500) break; // seasonal pages are large; cap for now
          }
          if (!auth.authenticated || !auth.username) return all;
          const library = await loadList({ workMode: 'Anime', kind: 'anime' });
          const byId = new Map(library.map((item) => [item.id, item]));
          return all.map((item) => {
            const listed = byId.get(item.id);
            return listed
              ? { ...item, ...listed, airDay: item.airDay, airTime: item.airTime }
              : item;
          });
        },
        { ttlDays: SEASONAL_CACHE_DAYS, force: query.force, staleWhenOffline: true }
      );
    }

    case 'TopAnime':
      return scrape.fetchTop('anime', query.topAnimeType ?? 'General', 0);

    case 'TopManga':
      return scrape.fetchTop('manga', query.topMangaType ?? 'All', 0);

    case 'MangaAdapted':
      return scrape.fetchMangaAdapted(query.adaptedType ?? 'All');

    case 'AnimeByGenre': {
      if (!query.genreId) return [];
      return cachedQuery(
        'tenrai',
        `genre_${query.genreId}`,
        async () => {
          const res = await tenrai.animeByGenre(query.genreId!, 1);
          return jikanToLibrary(res.data, 'anime');
        },
        { ttlDays: 7, staleWhenOffline: true }
      );
    }

    case 'AnimeByStudio': {
      if (!query.studioId) return [];
      return cachedQuery(
        'tenrai',
        `studio_${query.studioId}`,
        async () => {
          const res = await tenrai.animeByStudio(query.studioId!, 1);
          return jikanToLibrary(res.data, 'anime');
        },
        { ttlDays: 7, staleWhenOffline: true }
      );
    }

    default:
      void online;
      return [];
  }
}

/** Next page for modes that support "Load more" (TopAnime/TopManga/genre/studio). */
export async function loadMore(query: ListQuery, page: number): Promise<LibraryItem[]> {
  switch (query.workMode) {
    case 'TopAnime':
      return scrape.fetchTop('anime', query.topAnimeType ?? 'General', page);
    case 'TopManga':
      return scrape.fetchTop('manga', query.topMangaType ?? 'All', page);
    case 'AnimeByGenre': {
      const res = await tenrai.animeByGenre(query.genreId ?? 0, page);
      return jikanToLibrary(res.data, 'anime');
    }
    case 'AnimeByStudio': {
      const res = await tenrai.animeByStudio(query.studioId ?? 0, page);
      return jikanToLibrary(res.data, 'anime');
    }
    default:
      return [];
  }
}

/** Jikan-shaped payload → LibraryItem. */
export function jikanToLibrary(data: unknown[], kind: ListKind): LibraryItem[] {
  return (data ?? []).map((raw) => {
    const r = raw as Record<string, any>;
    return {
      id: r.mal_id,
      title: r.title,
      altTitle: r.title_english || r.title_japanese,
      imageUrl: r.images?.jpg?.large_image_url ?? r.images?.jpg?.image_url,
      mediaType: r.type,
      entryStatus: r.status,
      kind,
      episodes: r.episodes ?? undefined,
      chapters: r.chapters ?? undefined,
      volumes: r.volumes ?? undefined,
      score: r.score ?? undefined,
      genres: Array.isArray(r.genres) ? r.genres.map((g: any) => g.name) : undefined,
      airDay: airDayIndex(r.broadcast?.day),
      airTime: r.broadcast?.time,
      inList: false,
    } satisfies LibraryItem;
  });
}

const AIR_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function airDayIndex(day?: string): number | undefined {
  if (!day) return undefined;
  const idx = AIR_DAYS.findIndex((d) => d.toLowerCase() === day.toLowerCase());
  return idx === -1 ? undefined : idx;
}

/* ------------------------------------------------------------------ */
/* Sorting & filtering                                                 */
/* ------------------------------------------------------------------ */

export function filterByStatus(items: LibraryItem[], status: StatusKey | null | undefined): LibraryItem[] {
  if (!status) return items;
  return items.filter((i) => i.myStatus === status);
}

/** Port of `AnimeItemAbstraction` sort comparators. */
export function sortItems(items: LibraryItem[], option: SortOption, ascending: boolean): LibraryItem[] {
  const cmp = (a: LibraryItem, b: LibraryItem): number => {
    switch (option) {
      case 'SortTitle':
        return (a.altTitle || a.title).localeCompare(b.altTitle || b.title);
      case 'SortScore':
        return (a.myScore ?? 0) - (b.myScore ?? 0);
      case 'SortWatched':
        return (a.myProgress ?? 0) - (b.myProgress ?? 0);
      case 'SortAirDay':
        return (a.airDay ?? 99) - (b.airDay ?? 99);
      case 'SortLastWatched':
        return (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '');
      case 'SortStartDate':
        return (a.startDate ?? '').localeCompare(b.startDate ?? '');
      case 'SortEndDate':
        return (a.finishDate ?? '').localeCompare(b.finishDate ?? '');
      case 'SortPriority':
        return (a.priority ?? 0) - (b.priority ?? 0);
      case 'SortSeason':
        return (a.startDate ?? '').localeCompare(b.startDate ?? '');
      case 'SortNothing':
      default:
        return 0;
    }
  };
  const sorted = [...items].sort((a, b) => {
    // Entries not in the list sink to the bottom for status-based sorts.
    const result = cmp(a, b);
    return result !== 0 ? result : a.id - b.id;
  });
  return ascending ? sorted : sorted.reverse();
}

/* ------------------------------------------------------------------ */
/* List updates                                                        */
/* ------------------------------------------------------------------ */

const PENDING_KEY = 'pending:listUpdates';

interface PendingUpdate {
  kind: ListKind;
  id: number;
  update: ListStatusUpdate;
  remove?: boolean;
  at: number;
}

async function readPending(): Promise<PendingUpdate[]> {
  try {
    const raw = await cacheGet<PendingUpdate[]>('queue', 'updates');
    return raw?.value ?? [];
  } catch {
    return [];
  }
}

async function writePending(queue: PendingUpdate[]): Promise<void> {
  await cacheSet('queue', 'updates', queue);
}

/** Applies an update locally and queues it when offline. */
export async function applyListUpdate(
  kind: ListKind,
  item: LibraryItem,
  update: ListStatusUpdate
): Promise<LibraryItem> {
  const optimistic: LibraryItem = {
    ...item,
    inList: true,
    myStatus: (update.status as StatusKey) ?? item.myStatus,
    myScore: update.score ?? item.myScore,
    myProgress: update.progress ?? item.myProgress,
    myVolumes: update.volumes ?? item.myVolumes,
    isRewatching: update.isRewatching ?? item.isRewatching,
    startDate: update.startDate ?? item.startDate,
    finishDate: update.finishDate ?? item.finishDate,
    tags: update.tags ?? item.tags,
    updatedAt: new Date().toISOString(),
  };

  const online = await isOnline();
  if (!online) {
    const queue = await readPending();
    queue.push({ kind, id: item.id, update, at: Date.now() });
    await writePending(queue);
    return optimistic;
  }

  try {
    await updateListStatus(kind, item.id, update);
    await invalidateLibrary(kind);
    return optimistic;
  } catch {
    const queue = await readPending();
    queue.push({ kind, id: item.id, update, at: Date.now() });
    await writePending(queue);
    return optimistic;
  }
}

export async function removeEntry(kind: ListKind, item: LibraryItem): Promise<LibraryItem> {
  const online = await isOnline();
  if (online) {
    try {
      await removeListStatus(kind, item.id);
      await invalidateLibrary(kind);
    } catch {
      /* keep going — the local state is already updated */
    }
  }
  return { ...item, inList: false, myStatus: undefined, myScore: 0, myProgress: 0 };
}

/** Replays updates made while offline (Settings.AnimeSyncRequired flow). */
export async function flushPendingUpdates(): Promise<number> {
  const queue = await readPending();
  if (!queue.length) return 0;
  if (!(await isOnline())) return 0;

  const remaining: PendingUpdate[] = [];
  let flushed = 0;
  for (const entry of queue) {
    try {
      if (entry.remove) await removeListStatus(entry.kind, entry.id);
      else await updateListStatus(entry.kind, entry.id, entry.update);
      flushed++;
    } catch {
      remaining.push(entry);
    }
  }
  await writePending(remaining);
  if (flushed) await clearCache('api');
  void PENDING_KEY;
  return flushed;
}

export async function invalidateLibrary(kind?: ListKind): Promise<void> {
  if (kind) {
    const user = getAuth().username || 'me';
    await clearCache('api');
    void user;
  } else {
    await clearCache('api');
  }
}
