/**
 * Data models — direct ports of `MALClient.Models` shapes.
 * See: MALClient.Models/Models/Library/AnimeLibraryItemData.cs,
 *      MALClient.Models/Models/Anime/*, MALClient.Models/Enums/*
 */

export type ListKind = 'anime' | 'manga';

/** MALClient.Models/Enums/AnimeStatusEnum.cs (ints kept for parity). */
export const ANIME_STATUS = {
  Watching: 1,
  Completed: 2,
  OnHold: 3,
  Dropped: 4,
  PlanToWatch: 6,
  AllOrAiring: 7,
} as const;

export type StatusKey =
  | 'watching'
  | 'completed'
  | 'on_hold'
  | 'dropped'
  | 'plan_to_watch'
  | 'plan_to_read';

export interface StatusDescriptor {
  key: StatusKey;
  label: string;
  color: string;
  /** Value accepted by the MAL API v2 `status` form field. */
  apiValue: string;
}

export const STATUS_DESCRIPTORS: Record<StatusKey, StatusDescriptor> = {
  watching: { key: 'watching', label: 'Watching', color: '#228B22', apiValue: 'watching' },
  completed: { key: 'completed', label: 'Completed', color: '#1E90FF', apiValue: 'completed' },
  on_hold: { key: 'on_hold', label: 'On-Hold', color: '#FFD700', apiValue: 'on_hold' },
  dropped: { key: 'dropped', label: 'Dropped', color: '#DC143C', apiValue: 'dropped' },
  plan_to_watch: { key: 'plan_to_watch', label: 'Plan to Watch', color: '#808080', apiValue: 'plan_to_watch' },
  plan_to_read: { key: 'plan_to_read', label: 'Plan to Read', color: '#808080', apiValue: 'plan_to_read' },
};

export const ANIME_STATUS_LIST: StatusKey[] = [
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'plan_to_watch',
];

export const MANGA_STATUS_LIST: StatusKey[] = [
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'plan_to_read',
];

/** MALClient.Models/Enums/AnimeListModesEnum.cs */
export type WorkMode =
  | 'Anime'
  | 'SeasonalAnime'
  | 'Manga'
  | 'TopAnime'
  | 'TopManga'
  | 'AnimeByGenre'
  | 'AnimeByStudio'
  | 'MangaAdapted';

/** MALClient.Models/Enums/AnimeListModesEnum.cs */
export type DisplayMode = 'IndefiniteList' | 'IndefiniteGrid' | 'IndefiniteCompactList';

export type SortOption =
  | 'SortTitle'
  | 'SortScore'
  | 'SortWatched'
  | 'SortAirDay'
  | 'SortLastWatched'
  | 'SortStartDate'
  | 'SortEndDate'
  | 'SortNothing'
  | 'SortSeason'
  | 'SortPriority';

export const SORT_LABELS: Record<SortOption, string> = {
  SortTitle: 'Title',
  SortScore: 'Score',
  SortWatched: 'Watched',
  SortAirDay: 'Air day',
  SortLastWatched: 'Last updated',
  SortStartDate: 'Start date',
  SortEndDate: 'End Date',
  SortNothing: 'None',
  SortSeason: 'Season',
  SortPriority: 'Priority',
};

/** Exact names of `AnimeTopQuery.TopAnimeType` — labels come from ToString(). */
export const TOP_ANIME_TYPES = [
  'General',
  'Airing',
  'Upcoming',
  'Tv',
  'Movies',
  'Ovas',
  'Popular',
  'Favourited',
] as const;
export type TopAnimeType = (typeof TOP_ANIME_TYPES)[number];

/** Exact names of `AnimeTopQuery.MangaTopType`. */
export const TOP_MANGA_TYPES = [
  'All',
  'Manga',
  'Novels',
  'LightNovels',
  'OneShots',
  'Doujinshi',
  'Manhwa',
  'Manhua',
  'Popular',
  'Favourited',
] as const;
export type MangaTopType = (typeof TOP_MANGA_TYPES)[number];

/** Exact names of `AnimeAdaptedToAnimeQuery.MangaAdaptedType`. */
export const MANGA_ADAPTED_TYPES = ['All', 'AiringNow', 'UpcomingAnime'] as const;
export type MangaAdaptedType = (typeof MANGA_ADAPTED_TYPES)[number];

/**
 * Unified list entry — covers `AnimeLibraryItemData`, `SeasonalAnimeData`,
 * `TopAnimeData` (the original wraps all three in `AnimeItemAbstraction`).
 */
export interface LibraryItem {
  id: number;
  title: string;
  altTitle?: string;
  imageUrl?: string;
  /** media_type: tv, movie, ova, special, ona, music, manga, novel, manhwa… */
  mediaType?: string;
  /** airing / finished_airing / published / etc. */
  entryStatus?: string;
  kind: ListKind;
  /** Global/runtime */
  episodes?: number;
  chapters?: number;
  volumes?: number;
  score?: number;
  /** List state — absent for entries not in the user's list. */
  inList?: boolean;
  myStatus?: StatusKey;
  myScore?: number;
  myProgress?: number;
  myVolumes?: number;
  isRewatching?: boolean;
  startDate?: string;
  finishDate?: string;
  tags?: string;
  priority?: number;
  rewatchCount?: number;
  updatedAt?: string;
  /** VolatileDataCache fields */
  airDay?: number;
  airTime?: string;
  genres?: string[];
}

export interface PagedResult<T> {
  items: T[];
  hasNext: boolean;
  nextOffset?: number;
}

/** Tenrai/Jikan-shaped entry (extra fields we keep). */
export interface TenraiAnime {
  mal_id: number;
  title: string;
  images?: { jpg?: { image_url?: string; large_image_url?: string } };
  score?: number;
  episodes?: number;
  status?: string;
  type?: string;
  genres?: { mal_id: number; name: string }[];
  broadcast?: { day?: string; time?: string };
  aired?: { from?: string; to?: string };
  synopsis?: string;
  season?: string;
  year?: number;
  studios?: { mal_id: number; name: string }[];
  [k: string]: unknown;
}
