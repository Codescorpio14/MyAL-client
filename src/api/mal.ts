import { getAccessToken } from '@/api/auth';
import { fetchJson, formBody, HttpError } from '@/api/http';
import { LibraryItem, ListKind, PagedResult, StatusKey } from '@/api/types';

/**
 * Official MAL API v2 — `https://api.myanimelist.net/v2`
 * (ports MALClient.XShared/Comm/… list queries & MalApi list updates)
 */

const BASE = 'https://api.myanimelist.net/v2';

interface Paging {
  next?: string | null;
  previous?: string | null;
}

interface ListNode {
  id: number;
  title: string;
  alternative_titles?: { synonyms?: string[]; en?: string };
  main_picture?: { medium?: string; large?: string };
  media_type?: string;
  status?: string;
  num_episodes?: number;
  num_chapters?: number;
  num_volumes?: number;
  mean?: number;
  start_date?: string;
  end_date?: string;
  genres?: { id: number; name: string }[];
  broadcast?: { day_of_the_week?: string; day?: string; start_time?: string };
}

interface ListStatus {
  status?: string;
  score?: number;
  num_episodes_watched?: number;
  num_chapters_read?: number;
  num_volumes_read?: number;
  is_rewatching?: boolean;
  is_rereading?: boolean;
  tags?: string[];
  start_date?: string;
  finish_date?: string;
  priority?: number;
  num_times_rewatched?: number;
  num_times_reread?: number;
  update_at?: string;
  comments?: string;
}

interface ListResponse {
  data: { node: ListNode; list_status?: ListStatus }[];
  paging: Paging;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) throw new HttpError(401, 'Not authenticated', BASE);
  return { Authorization: `Bearer ${token}` };
}

const STATUS_FROM_API: Record<string, StatusKey> = {
  watching: 'watching',
  reading: 'watching', // manga's "reading" maps onto our shared StatusKey
  completed: 'completed',
  on_hold: 'on_hold',
  dropped: 'dropped',
  plan_to_watch: 'plan_to_watch',
  plan_to_read: 'plan_to_read',
};

function statusFromApi(status?: string): StatusKey | undefined {
  return status ? STATUS_FROM_API[status] : undefined;
}

function nodeToItem(kind: ListKind, node: ListNode, status?: ListStatus): LibraryItem {
  const isAnime = kind === 'anime';
  const airDayName = node.broadcast?.day_of_the_week ?? node.broadcast?.day;
  const airDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const airDay = airDayName ? airDayNames.indexOf(airDayName.toLowerCase()) : -1;
  const item: LibraryItem = {
    id: node.id,
    title: node.title,
    altTitle: node.alternative_titles?.en || node.alternative_titles?.synonyms?.[0],
    imageUrl: node.main_picture?.large || node.main_picture?.medium,
    mediaType: node.media_type,
    entryStatus: node.status,
    kind,
    episodes: node.num_episodes,
    chapters: node.num_chapters,
    volumes: node.num_volumes,
    score: node.mean,
    genres: node.genres?.map((g) => g.name),
    airDay: airDay >= 0 ? airDay : undefined,
    airTime: node.broadcast?.start_time,
  };
  if (status) {
    item.inList = true;
    item.myStatus = statusFromApi(status.status);
    item.myScore = status.score ?? 0;
    item.myProgress = isAnime ? status.num_episodes_watched ?? 0 : status.num_chapters_read ?? 0;
    item.myVolumes = isAnime ? undefined : status.num_volumes_read ?? 0;
    item.isRewatching = isAnime ? status.is_rewatching : status.is_rereading;
    item.startDate = status.start_date;
    item.finishDate = status.finish_date;
    item.tags = status.tags?.join(', ');
    item.priority = status.priority;
    item.rewatchCount = isAnime ? status.num_times_rewatched : status.num_times_reread;
    item.updatedAt = status.update_at;
  }
  return item;
}

const LIST_FIELDS =
  'id,title,alternative_titles,main_picture,media_type,status,num_episodes,num_chapters,num_volumes,mean,start_date,genres,list_status';

/** Fetches the whole list (paginated with limit=1000, like the original). */
export async function fetchLibrary(
  kind: ListKind,
  user: string,
  offset = 0
): Promise<PagedResult<LibraryItem>> {
  const headers = await authHeaders();
  const endpoint = kind === 'anime' ? 'animelist' : 'mangalist';
  const url =
    `${BASE}/users/${encodeURIComponent(user)}/${endpoint}` +
    `?fields=${LIST_FIELDS}&limit=1000&offset=${offset}&nsfw=true`;

  const response = await fetchJson<ListResponse>(url, { headers });
  const items = response.data.map((d) => nodeToItem(kind, d.node, d.list_status));
  const nextOffset = offset + response.data.length;
  return {
    items,
    hasNext: Boolean(response.paging.next),
    nextOffset: response.paging.next ? nextOffset : undefined,
  };
}

export interface ListStatusUpdate {
  status?: string;
  score?: number;
  /** anime: episodes, manga: chapters */
  progress?: number;
  volumes?: number;
  isRewatching?: boolean;
  priority?: number;
  tags?: string;
  startDate?: string;
  finishDate?: string;
  timesRewatched?: number;
  comments?: string;
}

/** `PUT /anime/{id}/my_list_status` (+ manga variant). */
export async function updateListStatus(kind: ListKind, id: number, update: ListStatusUpdate): Promise<ListStatus> {
  const headers = {
    ...(await authHeaders()),
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const isAnime = kind === 'anime';
  const data: Record<string, string | number | boolean | undefined> = {};
  if (update.status !== undefined) {
    // Manga uses `reading`, anime uses `watching`; everything else matches.
    data.status = !isAnime && update.status === 'watching' ? 'reading' : update.status;
  }
  if (update.score !== undefined) data.score = update.score;
  if (update.progress !== undefined) {
    if (isAnime) data.num_watched_episodes = update.progress;
    else data.num_chapters_read = update.progress;
  }
  if (!isAnime && update.volumes !== undefined) data.num_volumes_read = update.volumes;
  if (update.isRewatching !== undefined) data[isAnime ? 'is_rewatching' : 'is_rereading'] = update.isRewatching;
  if (update.priority !== undefined) data.priority = update.priority;
  if (update.tags !== undefined) data.tags = update.tags;
  if (update.startDate !== undefined) data.start_date = update.startDate;
  if (update.finishDate !== undefined) data.finish_date = update.finishDate;
  if (update.comments !== undefined) data.comments = update.comments;
  if (isAnime && update.timesRewatched !== undefined) data.num_times_rewatched = update.timesRewatched;

  return fetchJson<ListStatus>(
    `${BASE}/${kind}/${id}/my_list_status`,
    { method: 'PUT', headers, body: formBody(data) },
    30_000
  );
}

/** `DELETE /anime/{id}/my_list_status` */
export async function removeListStatus(kind: ListKind, id: number): Promise<void> {
  const headers = await authHeaders();
  await fetchJson(`${BASE}/${kind}/${id}/my_list_status`, { method: 'DELETE', headers });
}

export interface MalDetails {
  id: number;
  title: string;
  alternative_titles?: { synonyms?: string[]; en?: string };
  main_picture?: { medium?: string; large?: string };
  start_date?: string;
  end_date?: string;
  synopsis?: string;
  mean?: number;
  rank?: number;
  popularity?: number;
  num_list_users?: number;
  num_scoring_users?: number;
  media_type?: string;
  status?: string;
  genres?: { id: number; name: string }[];
  my_list_status?: ListStatus;
  num_episodes?: number;
  num_chapters?: number;
  num_volumes?: number;
  background?: string;
  related_anime?: { id: number; title: string; type: string }[];
  related_manga?: { id: number; title: string; type: string }[];
  recommendations?: { id: number; title: string; main_picture?: { medium?: string } }[];
  studios?: { id: number; name: string }[];
  source?: string;
  duration?: string;
  rating?: string;
}

export async function fetchDetails(kind: ListKind, id: number): Promise<MalDetails> {
  const headers = await authHeaders();
  const fields = [
    'id',
    'title',
    'alternative_titles',
    'main_picture',
    'start_date',
    'end_date',
    'synopsis',
    'mean',
    'rank',
    'popularity',
    'num_list_users',
    'num_scoring_users',
    'media_type',
    'status',
    'genres',
    'my_list_status',
    'num_episodes',
    'num_chapters',
    'num_volumes',
    'background',
    'related_anime',
    'related_manga',
    'recommendations',
    'studios',
    'source',
    'duration',
    'rating',
  ].join(',');
  return fetchJson<MalDetails>(`${BASE}/${kind}/${id}?fields=${fields}`, { headers });
}

/** `GET /anime/season/{year}/{season}` — primary seasonal source. */
export async function fetchSeasonal(
  year: number,
  season: 'winter' | 'spring' | 'summer' | 'fall',
  offset = 0
): Promise<PagedResult<LibraryItem>> {
  const headers = await authHeaders();
  const fields =
    'id,title,main_picture,mean,media_type,num_episodes,genres,broadcast,start_date,list_status';
  const url =
    `${BASE}/anime/season/${year}/${season}?sort=anime_num_list_users&limit=100&fields=${fields}&offset=${offset}&nsfw=true`;
  const response = await fetchJson<ListResponse>(url, { headers });
  const items = response.data.map((d) => nodeToItem('anime', d.node, d.list_status));
  return {
    items,
    hasNext: Boolean(response.paging.next),
    nextOffset: response.paging.next ? offset + response.data.length : undefined,
  };
}

/** `GET /users/@me` */
export async function fetchMe(): Promise<{ id: number; name: string; picture?: string }> {
  const headers = await authHeaders();
  return fetchJson(`${BASE}/users/@me?fields=id,name,picture`, { headers });
}
