import { cachedQuery } from '@/api/cache';
import { getAuth } from '@/api/auth';
import {
  attrOf,
  balancedBlocks,
  cleanImageUrl,
  decodeEntities,
  group1,
  idFromHref,
  textOf,
} from '@/api/html';
import { encodeQuery, fetchJson, fetchText, RequestGate, withRetries } from '@/api/http';
import {
  LibraryItem,
  MangaAdaptedType,
  MangaTopType,
  TopAnimeType,
} from '@/api/types';

/**
 * myanimelist.net scraping — ports AnimeTopQuery & AnimeAdaptedToAnimeQuery
 * (HtmlAgilityPack → lightweight tag-balanced regex parsing).
 */

const gate = new RequestGate(150);

async function getPage(url: string, authenticated = false): Promise<string> {
  const cookies = authenticated ? getAuth().cookies : '';
  return gate.run(() =>
    withRetries(() =>
      fetchText(url, {
        headers: {
          'User-Agent': 'MALClient/3.0',
          ...(cookies ? { Cookie: cookies } : {}),
        },
      }), 3)
  );
}

export interface PersonalizedRecommendation {
  id: number;
  kind: 'anime' | 'manga';
  title: string;
  imageUrl?: string;
  bundle?: string;
}

/** MAL's signed-in auto-recommendation feed, as used by the legacy client. */
export async function fetchPersonalizedRecommendations(
  kind: 'anime' | 'manga',
  force = false,
): Promise<PersonalizedRecommendation[]> {
  const auth = getAuth();
  if (!auth.authenticated || !auth.username) {
    throw new Error('Sign in to MAL to load personalized recommendations.');
  }
  if (!auth.cookies) {
    throw new Error('Your MAL website session is unavailable. Sign in again to load recommendations.');
  }
  const userKey = auth.username.toLowerCase();
  return cachedQuery(
    'scrape',
    `personalized_recommendations_${userKey}_${kind}`,
    async () => {
      const home = await getPage('https://myanimelist.net/', true);
      const placementId = `v-auto-recommendation-personalized_${kind}`;
      const placementBlock = (home.match(/<div\b[^>]*>/gi) ?? []).find((tag) =>
        attrOf(tag, 'id') === placementId
      );
      const placement = attrOf(placementBlock, 'data-placement');
      if (!placement) {
        throw new Error('MAL did not provide personalized recommendations for this account.');
      }
      const cookies = getAuth().cookies;
      const result = await gate.run(() =>
        withRetries(
          () => fetchJson<unknown>(`https://myanimelist.net/auto_recommendation/personalized_suggestions.json?placement=${encodeURIComponent(placement)}`, {
            headers: {
              'User-Agent': 'MALClient/3.0',
              Accept: 'application/json',
              Cookie: cookies,
            },
          }),
          3,
        ),
      );
      if (!Array.isArray(result)) {
        throw new Error('MAL returned an invalid personalized recommendation response.');
      }
      return result.flatMap((value): PersonalizedRecommendation[] => {
        if (!value || typeof value !== 'object') return [];
        const row = value as Record<string, unknown>;
        const path = typeof row.path === 'string' ? row.path : '';
        const matched = /\/(anime|manga)\/(\d+)(?:\/|$)/i.exec(path);
        const id = typeof row.id === 'number' ? row.id : Number(row.id);
        const pathKind = matched?.[1]?.toLowerCase();
        const resolvedKind = matched ? pathKind : kind;
        if (!Number.isSafeInteger(id) || id <= 0 || resolvedKind !== kind) return [];
        const title = typeof row.title === 'string' && row.title.trim() ? decodeEntities(row.title.trim()) : `${kind} #${id}`;
        const imageUrl = typeof row.image === 'string' ? cleanImageUrl(row.image) : undefined;
        return [{
          id,
          kind,
          title,
          imageUrl,
          bundle: typeof row.bundle === 'string' ? decodeEntities(row.bundle) : undefined,
        }];
      });
    },
    { ttlDays: 1, force, staleWhenOffline: true },
  );
}

export interface ProfileHistoryEntry {
  id: number;
  kind: 'anime' | 'manga';
  title: string;
  progress: number;
  date: string;
}

export interface ProfileHistoryGroup {
  date: string;
  entries: ProfileHistoryEntry[];
}

export interface ProfileOverview {
  imageUrl?: string;
  about: string;
  details: { label: string; value: string }[];
  animeStats: { label: string; value: string }[];
  mangaStats: { label: string; value: string }[];
  updates: {
    id: number;
    kind: 'anime' | 'manga';
    title: string;
    imageUrl?: string;
    progress?: string;
    date?: string;
  }[];
}

function readProfileStats(profileHtml: string, kind: 'anime' | 'manga'): ProfileOverview['animeStats'] {
  const block = balancedBlocks(profileHtml, 'div', (open) => hasClass(open, 'stats') && hasClass(open, kind))[0] ?? '';
  if (!block) return [];
  const values: { label: string; value: string }[] = [];
  const scoreBlock = balancedBlocks(block, 'div', (open) => hasClass(open, 'stat-score'))[0] ?? '';
  const scoreText = textOf(scoreBlock);
  const days = /Days:\s*([\d,.]+)/i.exec(scoreText)?.[1];
  const mean = /Mean Score:\s*([\d,.]+)/i.exec(scoreText)?.[1];
  if (days) values.push({ label: kind === 'anime' ? 'Days watched' : 'Days read', value: days });
  if (mean) values.push({ label: 'Mean score', value: mean });

  const statusList = balancedBlocks(block, 'ul', (open) => hasClass(open, 'stats-status'))[0] ?? '';
  for (const row of balancedBlocks(statusList, 'li')) {
    const text = textOf(row);
    const count = /([\d,]+)\s*$/.exec(text)?.[1];
    const label = text.replace(/[\d,]+\s*$/, '').trim();
    if (label && count) values.push({ label, value: count });
  }
  const dataList = balancedBlocks(block, 'ul', (open) => hasClass(open, 'stats-data'))[0] ?? '';
  for (const row of balancedBlocks(dataList, 'li')) {
    const spans = balancedBlocks(row, 'span').map(textOf);
    const label = spans[0]?.trim();
    const value = spans.at(-1)?.replace(/,/g, '').trim();
    if (label && value) values.push({ label, value });
  }
  return values;
}

/** Scrapes a public MAL profile's summary, statistics, and recent anime/manga updates. */
export async function fetchProfileOverview(username: string, force = false): Promise<ProfileOverview> {
  const source = username.trim();
  if (!source) throw new Error('A MAL username is required to load a profile.');
  return cachedQuery(
    'scrape',
    `profile_overview_${source.toLowerCase()}`,
    async () => {
      const ownProfile = getAuth().username.toLowerCase() === source.toLowerCase();
      const html = await getPage(`https://myanimelist.net/profile/${encodeURIComponent(source)}`, ownProfile);
      const imageBlock = balancedBlocks(html, 'div', (open) => hasClass(open, 'user-image') && hasClass(open, 'mb8'))[0] ?? '';
      const profileImage = /<img\b[^>]*>/i.exec(imageBlock)?.[0];
      const detailList = balancedBlocks(html, 'ul', (open) =>
        hasClass(open, 'user-status') && hasClass(open, 'border-top')
      )[0] ?? '';
      const details = balancedBlocks(detailList, 'li').flatMap((row) => {
        const title = balancedBlocks(row, 'span', (open) => hasClass(open, 'user-status-title'))[0];
        const data = balancedBlocks(row, 'span', (open) => hasClass(open, 'user-status-data'))[0];
        const label = textOf(title);
        const value = textOf(data);
        return label && value && label !== 'Supporter' ? [{ label, value }] : [];
      });
      const aboutBlock = balancedBlocks(html, 'div', (open) =>
        hasClass(open, 'profile-about-user') && hasClass(open, 'js-truncate-inner')
      )[0] ?? '';
      const updates = balancedBlocks(html, 'div', (open) =>
        hasClass(open, 'statistics-updates') && hasClass(open, 'di-b')
      ).flatMap((block, index): ProfileOverview['updates'] => {
        const anchor = (block.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).find((item) =>
          /\/(?:anime|manga)\/\d+/i.test(attrOf(item.slice(0, item.indexOf('>') + 1), 'href') ?? '')
        );
        const href = attrOf(anchor?.slice(0, anchor.indexOf('>') + 1), 'href');
        const kind = /\/manga\/\d+/i.test(href ?? '') ? 'manga' : 'anime';
        const id = idFromHref(href, kind);
        const title = textOf(anchor);
        if (!id || !title) return [];
        const image = /<img\b[^>]*>/i.exec(anchor ?? '')?.[0];
        const graph = balancedBlocks(block, 'div', (open) => hasClass(open, 'graph-content'))[0] ?? '';
        const date = balancedBlocks(graph, 'span', (open) => hasClass(open, 'fn-grey2'))[0];
        const progress = textOf(graph.replace(date ?? '', ''));
        return [{
          id,
          kind,
          title,
          imageUrl: cleanImageUrl(attrOf(image, 'data-src') ?? attrOf(image, 'src')),
          progress: progress || undefined,
          date: textOf(date) || undefined,
        }];
      });
      return {
        imageUrl: cleanImageUrl(attrOf(profileImage, 'data-src') ?? attrOf(profileImage, 'src')),
        about: textOf(aboutBlock),
        details,
        animeStats: readProfileStats(html, 'anime'),
        mangaStats: readProfileStats(html, 'manga'),
        updates,
      };
    },
    { ttlDays: 0.25, force, staleWhenOffline: true }
  );
}

export interface MalClub {
  id: string;
  name: string;
  imageUrl?: string;
  description: string;
  members: string;
  lastComment?: string;
  lastPost?: string;
  joinAction: 'join' | 'request' | 'none';
}

export interface PromotionalVideo {
  animeId: number;
  animeTitle: string;
  name: string;
  thumbnailUrl: string;
  videoUrl: string;
}

/** MAL's promotional-video index, matching the legacy PopularVideosQuery. */
export async function fetchPromotionalVideos(force = false): Promise<PromotionalVideo[]> {
  return cachedQuery(
    'scrape',
    'mal_promotional_videos',
    async () => {
      const html = await getPage('https://myanimelist.net/watch/promotion');
      const blocks = balancedBlocks(html, 'div', (open) => hasClass(open, 'video-list-outer-vertical'));
      const videos: PromotionalVideo[] = [];
      for (const block of blocks) {
        const videoAnchor = (block.match(/<a\b[^>]*>/gi) ?? []).find((tag) =>
          /youtube(?:-nocookie)?\.com\/embed\//i.test(attrOf(tag, 'href') ?? '') &&
          Boolean(attrOf(tag, 'data-anime-id'))
        );
        const href = attrOf(videoAnchor, 'href');
        const videoId = href ? /\/embed\/([^/?#]+)/i.exec(href)?.[1] : undefined;
        const animeIdValue = attrOf(videoAnchor, 'data-anime-id');
        const animeId = animeIdValue ? Number(animeIdValue) : NaN;
        const thumbnail = cleanImageUrl(attrOf(videoAnchor, 'data-bg'));
        const nameBlock = balancedBlocks(block, 'div', (open) => hasClass(open, 'info-container'))[0];
        const anchors = block.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
        const animeAnchor = [...anchors].reverse().find((anchor) =>
          /\/anime\/\d+/i.test(attrOf(anchor, 'href') ?? '')
        );
        const animeTitle = animeAnchor ? textOf(animeAnchor) : '';
        const name = nameBlock ? textOf(nameBlock) : '';
        if (
          !videoId ||
          !Number.isSafeInteger(animeId) ||
          animeId <= 0 ||
          !thumbnail ||
          /banned/i.test(thumbnail) ||
          !animeTitle ||
          !name
        ) {
          continue;
        }
        videos.push({
          animeId,
          animeTitle,
          name,
          thumbnailUrl: thumbnail.startsWith('//') ? `https:${thumbnail}` : thumbnail,
          videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        });
      }
      return videos;
    },
    { ttlDays: 1, force, staleWhenOffline: true }
  );
}

/** Reads MAL's grouped profile history, matching the legacy HistoryViewModel. */
export async function fetchProfileHistory(username: string, force = false): Promise<ProfileHistoryGroup[]> {
  const source = username.trim();
  if (!source) throw new Error('A MAL username is required to load history.');
  return cachedQuery(
    'scrape',
    `profile_history_${source.toLowerCase()}`,
    async () => {
      const isOwnProfile = getAuth().username.toLowerCase() === source.toLowerCase();
      const html = await getPage(`https://myanimelist.net/history/${encodeURIComponent(source)}`, isOwnProfile);
      const groups: ProfileHistoryGroup[] = [];
      for (const row of balancedBlocks(html, 'tr')) {
        if (/class=["'][^"']*\bnormal_header\b/i.test(row)) {
          const date = textOf(row.replace(/^<tr\b[^>]*>/i, '').replace(/<\/tr>$/i, ''));
          if (date) groups.push({ date, entries: [] });
          continue;
        }
        const link = (row.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).find((candidate) =>
          /(?:\/anime\/|\/manga\/|[?&]id=)/i.test(attrOf(candidate, 'href') ?? '')
        );
        if (!link) continue;
        const href = attrOf(link, 'href') ?? '';
        const idMatch = /(?:\/(?:anime|manga)\/|[?&]id=)(\d+)/i.exec(href);
        if (!idMatch) continue;
        const kind = /\/manga(?:[/.?]|$)/i.test(href) ? 'manga' : 'anime';
        const progressText = textOf((/<strong\b[^>]*>[\s\S]*?<\/strong>/i.exec(row) ?? [])[0]);
        const progress = Number.parseInt(progressText, 10);
        const cells = balancedBlocks(row, 'td');
        const date = cells.length ? textOf(cells[cells.length - 1]).replace(/\bEdit\b/g, '').trim() : '';
        const title = textOf(link) || `${kind === 'anime' ? 'Anime' : 'Manga'} #${idMatch[1]}`;
        if (!Number.isFinite(progress)) continue;
        if (!groups.length) groups.push({ date: date || 'History', entries: [] });
        groups[groups.length - 1].entries.push({ id: Number(idMatch[1]), kind, title, progress, date });
      }
      return groups.filter((group) => group.entries.length > 0);
    },
    { ttlDays: 1, force, staleWhenOffline: true }
  );
}

export type ClubCategory =
  | 'all'
  | 'anime'
  | 'conventions'
  | 'artists'
  | 'characters'
  | 'companies'
  | 'games'
  | 'japan'
  | 'music'
  | 'cities'
  | 'manga'
  | 'schools'
  | 'other';

const CLUB_CATEGORY_ID: Record<ClubCategory, number> = {
  all: 0,
  anime: 1,
  conventions: 2,
  artists: 3,
  characters: 4,
  companies: 5,
  games: 6,
  japan: 7,
  cities: 8,
  music: 9,
  manga: 10,
  schools: 11,
  other: 12,
};

function clubFromRow(row: string, own: boolean): MalClub | undefined {
  const cells = balancedBlocks(row, 'td');
  if (cells.length < 3) return undefined;
  const link = (cells[0].match(/<a\b[^>]*>/gi) ?? []).find((anchor) =>
    /clubs\.php\?(?:[^"']*?&)?(?:cid|id)=\d+|\/clubs\/\d+/i.test(attrOf(anchor, 'href') ?? '')
  );
  const href = attrOf(link, 'href') ?? '';
  const clubId = /(?:cid|id)=(\d+)|\/clubs\/(\d+)/i.exec(href);
  const imgTag = /<img\b[^>]*>/i.exec(cells[0])?.[0];
  const name = textOf(attrOf(imgTag, 'alt') ?? '');
  const id = clubId?.[1] ?? clubId?.[2];
  if (!id || !name) return undefined;
  const srcset = attrOf(imgTag, 'data-srcset') ?? attrOf(imgTag, 'srcset');
  let imageUrl = attrOf(imgTag, 'data-src') ?? attrOf(imgTag, 'src') ?? srcset?.split(',').pop()?.trim().split(/\s+/)[0];
  if (imageUrl?.startsWith('//')) imageUrl = `https:${imageUrl}`;
  const comment = textOf(cells[2]);
  const action = textOf(cells[4] ?? '');
  return {
    id,
    name,
    imageUrl: cleanImageUrl(imageUrl),
    description: textOf(cells[0]),
    members: textOf(cells[1]),
    lastComment: comment,
    lastPost: textOf(cells[3] ?? ''),
    joinAction: own ? 'none' : /\bjoin\b/i.test(action) ? 'join' : /\brequest\b/i.test(action) ? 'request' : 'none',
  };
}

/** Fetches MAL's club directory or the signed-in user's clubs. */
export async function fetchClubs(options: {
  own?: boolean;
  category?: ClubCategory;
  query?: string;
  page?: number;
  force?: boolean;
} = {}): Promise<MalClub[]> {
  const own = options.own ?? false;
  const category = options.category ?? 'all';
  const query = options.query?.trim() ?? '';
  const page = Math.max(0, options.page ?? 0);
  const username = own ? getAuth().username.toLowerCase() : '';
  if (!own && query.length === 1) return [];
  if (own && !getAuth().authenticated) throw new Error('Sign in to MAL to view your clubs.');
  if (own && !getAuth().cookies) throw new Error('Your MAL website session is unavailable. Sign in again to view your clubs.');
  return cachedQuery(
    'scrape',
    `clubs_${own ? `own_${username}` : category}_${query.toLowerCase()}_${page}`,
    async () => {
      const path = own
        ? 'clubs.php?action=myclubs'
        : `clubs.php?catid=${CLUB_CATEGORY_ID[category]}${query.length >= 2 ? `&cn=${encodeURIComponent(query)}&action=find` : ''}&p=${page}`;
      const html = await getPage(`https://myanimelist.net/${path}`, own);
      const rows = balancedBlocks(html, 'tr', (open) =>
        (attrOf(open, 'class') ?? '').split(/\s+/).includes('table-data')
      );
      return rows.map((row) => clubFromRow(row, own)).filter((club): club is MalClub => Boolean(club));
    },
    { ttlDays: 1, force: options.force, staleWhenOffline: true }
  );
}

const TOP_ANIME_ENDPOINT: Record<TopAnimeType, string> = {
  General: 'topanime.php?limit={p}',
  Airing: 'topanime.php?type=airing&limit={p}',
  Upcoming: 'topanime.php?type=upcoming&limit={p}',
  Tv: 'topanime.php?type=tv&limit={p}',
  Movies: 'topanime.php?type=movie&limit={p}',
  Ovas: 'topanime.php?type=ova&limit={p}',
  Popular: 'topanime.php?type=bypopularity&limit={p}',
  Favourited: 'topanime.php?type=favorite&limit={p}',
};

const TOP_MANGA_ENDPOINT: Record<MangaTopType, string> = {
  All: 'topmanga.php?limit={p}',
  Manga: 'topmanga.php?type=manga&limit={p}',
  Novels: 'topmanga.php?type=novels&limit={p}',
  LightNovels: 'topmanga.php?type=lightnovels&limit={p}',
  OneShots: 'topmanga.php?type=oneshots&limit={p}',
  Doujinshi: 'topmanga.php?type=doujin&limit={p}',
  Manhwa: 'topmanga.php?type=manhwa&limit={p}',
  Manhua: 'topmanga.php?type=manhua&limit={p}',
  Popular: 'topmanga.php?type=bypopularity&limit={p}',
  Favourited: 'topmanga.php?type=favorite&limit={p}',
};

/** `div.information di-ib mt4` → "TV (43 eps)" / "Movie (? eps)" */
function parseEpisodeCount(row: string): number | undefined {
  const info = /<div class="information di-ib mt4">([\s\S]*?)<\/div>/.exec(row)?.[1] ?? '';
  const inner = textOf(info);
  const paren = inner.indexOf('(');
  if (paren === -1) return undefined;
  const after = inner.slice(paren + 1);
  const num = /^\s*(\d+)/.exec(after);
  return num ? parseInt(num[1], 10) : undefined;
}

/** Rebuilds the cdn url from a `data-srcset` value like the original does. */
function parseTopImage(row: string, kind: 'anime' | 'manga'): string | undefined {
  const imgTag = /<img\b[^>]*>/.exec(row)?.[0];
  const srcset = attrOf(imgTag, 'data-srcset');
  if (srcset) {
    const last = srcset.split(',').pop() ?? '';
    const url = last.trim().replace(/\s+\dx$/, '');
    const parts = url.split('/');
    if (parts.length >= 3) {
      const tail = parts.slice(-2).join('/');
      return `https://cdn.myanimelist.net/images/${kind}/${tail}`;
    }
  }
  const src = cleanImageUrl(attrOf(imgTag, 'data-src') ?? attrOf(imgTag, 'src'));
  return src;
}

function parseTopRow(row: string, kind: 'anime' | 'manga', rank: number): LibraryItem | undefined {
  const titleA = /<h3[^>]*>\s*<a\b[^>]*>/.exec(row);
  const h3Start = row.indexOf('<h3');
  const anchorTag = h3Start !== -1 ? /<a\b[^>]*>/.exec(row.slice(h3Start))?.[0] : undefined;
  const href = attrOf(anchorTag, 'href');
  const id = idFromHref(href, kind);
  if (id === undefined) return undefined;

  const titleHtml = h3Start !== -1 ? /<h3[^>]*>([\s\S]*?)<\/h3>/.exec(row.slice(h3Start))?.[1] : undefined;
  const title = textOf(titleHtml ?? '');
  if (!title) return undefined;

  const scoreRaw = /<span class="text(?: on)?">([\s\S]*?)<\/span>/.exec(row)?.[1];
  const score = scoreRaw ? parseFloat(textOf(scoreRaw)) : 0;

  void titleA;
  return {
    id,
    title: decodeEntities(title),
    kind,
    imageUrl: parseTopImage(row, kind),
    episodes: parseEpisodeCount(row),
    score: Number.isNaN(score) ? 0 : score,
    inList: false,
  };
}

/** `topanime.php` / `topmanga.php` — 50 entries per page. */
export async function fetchTop(
  kind: 'anime' | 'manga',
  type: string,
  page: number
): Promise<LibraryItem[]> {
  const template = kind === 'anime' ? TOP_ANIME_ENDPOINT[type as TopAnimeType] : TOP_MANGA_ENDPOINT[type as MangaTopType];
  if (!template) return [];
  const url = `https://myanimelist.net/${template.replace('{p}', String(page * 50))}`;

  return cachedQuery(
    'scrape',
    `top_${kind}_${type}_${page}`,
    async () => {
      const html = await getPage(url);
      const tableStart = html.indexOf('top-ranking-table');
      const scope = tableStart === -1 ? html : html.slice(tableStart);
      const rows = balancedBlocks(scope, 'tr', (t) => t.includes('ranking-list'));
      const items: LibraryItem[] = [];
      rows.forEach((row, i) => {
        const item = parseTopRow(row, kind, page * 50 + i + 1);
        if (item) items.push(item);
      });
      return items;
    },
    { ttlDays: 7 }
  );
}

/** `manga/adapted[?type=…]` — the "Adapted to anime" section. */
export async function fetchMangaAdapted(type: MangaAdaptedType): Promise<LibraryItem[]> {
  const query = type === 'All' ? '?type=all' : type === 'UpcomingAnime' ? '?type=upcoming' : '';
  const url = `https://myanimelist.net/manga/adapted${query}`;

  return cachedQuery(
    'scrape',
    `adapted_${type}`,
    async () => {
      const html = await getPage(url);
      const cards = balancedBlocks(html, 'div', (t) => t.includes('js-seasonal-anime'));
      const items: LibraryItem[] = [];
      for (const card of cards) {
        const linkTag = /<a\b[^>]*class="[^"]*link-title[^"]*"[^>]*>|<a\b[^>]*>/i.exec(
          /<a\b[^>]*class="[^"]*link-title[^"]*"[^>]*>/i.exec(card)?.[0] ?? /<a\b[^>]*>/.exec(card)?.[0] ?? ''
        )?.[0];
        const titleAnchor = /<a class="link-title"[^>]*>([\s\S]*?)<\/a>/.exec(card);
        const title = textOf(titleAnchor?.[1]);
        const href = attrOf(titleAnchor?.[0], 'href');
        const id = idFromHref(href, 'manga');
        if (id === undefined || !title) continue;

        const imgTag = /<img\b[^>]*>/.exec(card)?.[0];
        const scoreDiv = /<div class="[^"]*scormem-item score[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(card);
        const score = scoreDiv ? parseFloat(textOf(scoreDiv[1])) : 0;
        void linkTag;

        items.push({
          id,
          title,
          kind: 'manga',
          imageUrl: cleanImageUrl(attrOf(imgTag, 'data-src') ?? attrOf(imgTag, 'src')),
          score: Number.isNaN(score) ? 0 : score,
          inList: false,
        });
      }
      return items;
    },
    { ttlDays: 3 }
  );
}

export type ArticleMode = 'articles' | 'news';

export interface MalArticle {
  url: string;
  title: string;
  imageUrl?: string;
  highlight?: string;
  author?: string;
  views?: string;
  tags: string[];
  mode: ArticleMode;
}

export interface CommunityRecommendation {
  id: number;
  title: string;
  imageUrl?: string;
  kind: 'anime' | 'manga';
  sourceId: number;
  sourceTitle: string;
  description: string;
}

function hasClass(openTag: string, className: string): boolean {
  const classes = attrOf(openTag, 'class')?.split(/\s+/) ?? [];
  return classes.includes(className);
}

function firstMatch(html: string, pattern: RegExp): string {
  const match = pattern.exec(html)?.[1];
  return match ? textOf(match) : '';
}

function articleFromBlock(block: string, mode: ArticleMode): MalArticle | undefined {
  const anchors = block.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  const articlePath = mode === 'news' ? /\/news\/\d+(?:\/|$|\?)/i : /\/featured\/\d+(?:\/|$|\?)/i;
  const titleAnchor = anchors.find((anchor) => {
    const href = attrOf(anchor, 'href') ?? '';
    return articlePath.test(href);
  });
  if (!titleAnchor) return undefined;
  const rawUrl = attrOf(titleAnchor, 'href');
  if (!rawUrl) return undefined;
  const url = rawUrl.startsWith('http') ? rawUrl : `https://myanimelist.net${rawUrl}`;
  const paragraphs = block.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  const title = firstMatch(block, /<p\b[^>]*class=["'][^"']*(?:title|title-text)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i) ||
    textOf(titleAnchor.replace(/<img\b[^>]*>/gi, ''));
  if (!title) return undefined;
  const imgTag = /<img\b[^>]*>/i.exec(block)?.[0];
  const dataBg = attrOf(titleAnchor, 'data-bg');
  let imageUrl = cleanImageUrl(dataBg ?? attrOf(imgTag, 'data-src') ?? attrOf(imgTag, 'src'));
  if (imageUrl?.startsWith('//')) imageUrl = `https:${imageUrl}`;
  const info = balancedBlocks(block, 'div', (open) => hasClass(open, 'information'))[0] ?? '';
  const infoParagraphs = info.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  const tags = [...block.matchAll(/<a\b[^>]*class=["'][^"']*tag[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => textOf(match[1]))
    .filter(Boolean);
  const highlight = paragraphs.map(textOf).find((text) => text && text !== title);
  return {
    url,
    title,
    imageUrl,
    highlight,
    author: infoParagraphs[0] ? textOf(infoParagraphs[0]) : undefined,
    views: infoParagraphs[1] ? textOf(infoParagraphs[1]) : undefined,
    tags,
    mode,
  };
}

/** MAL featured-article and news indexes, cache-first with explicit refresh. */
export async function fetchArticles(mode: ArticleMode, force = false): Promise<MalArticle[]> {
  return cachedQuery(
    'scrape',
    `mal_articles_${mode}`,
    async () => {
      const html = await getPage(`https://myanimelist.net/${mode === 'articles' ? 'featured' : 'news'}`);
      const classes = mode === 'articles'
        ? ['featured-pickup-unit', 'news-unit']
        : ['news-unit'];
      const blocks = classes.flatMap((className) =>
        balancedBlocks(html, 'div', (open) => hasClass(open, className) && (mode === 'articles' || hasClass(open, 'rect')))
      );
      const unique = new Map<string, MalArticle>();
      for (const block of blocks) {
        const item = articleFromBlock(block, mode);
        if (item) unique.set(item.url, item);
      }
      return [...unique.values()];
    },
    { ttlDays: 1, force, staleWhenOffline: true }
  );
}

/** Returns only the article body, without the surrounding MAL page or comments. */
export async function fetchArticleHtml(url: string, force = false): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'myanimelist.net') {
    throw new Error('Article URL must be an HTTPS MyAnimeList URL.');
  }
  return cachedQuery(
    'scrape',
    `mal_article_body_v2_${encodeURIComponent(parsed.pathname)}`,
    async () => {
      const html = await getPage(parsed.toString());
      const body = balancedBlocks(html, 'div', (open) => hasClass(open, 'content') && hasClass(open, 'clearfix'))
        .find((block) => /<img\b|<iframe\b|<p\b|<br\b/i.test(block));
      if (!body) throw new Error('The article body could not be found.');
      return body;
    },
    { ttlDays: 7, force, staleWhenOffline: true }
  );
}

/** Latest MAL community recommendations (`recommendations.php?s=recentrecs`). */
export async function fetchCommunityRecommendations(
  kind: 'anime' | 'manga',
  force = false
): Promise<CommunityRecommendation[]> {
  return cachedQuery(
    'scrape',
    `community_recommendations_${kind}`,
    async () => {
      const html = await getPage(`https://myanimelist.net/recommendations.php?s=recentrecs&t=${kind}`);
      const blocks = balancedBlocks(html, 'div', (open) =>
        hasClass(open, 'spaceit') && hasClass(open, 'borderClass')
      );
      const output: CommunityRecommendation[] = [];
      for (const block of blocks.slice(0, 30)) {
        const links = (block.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [])
          .filter((anchor) => attrOf(anchor, 'title') && /\/(anime|manga)\/\d+/.test(attrOf(anchor, 'href') ?? ''));
        if (links.length < 2) continue;
        const sourceHref = attrOf(links[0], 'href') ?? '';
        const targetHref = attrOf(links[1], 'href') ?? '';
        const sourceMatch = /\/(anime|manga)\/(\d+)/.exec(sourceHref);
        const targetMatch = /\/(anime|manga)\/(\d+)/.exec(targetHref);
        if (!sourceMatch || !targetMatch || targetMatch[1] !== kind) continue;
        const descriptionBlock = balancedBlocks(block, 'div', (open) =>
          hasClass(open, 'recommendations-user-recs-text')
        )[0] ?? '';
        const suggestedTitle = attrOf(links[1], 'title') || textOf(links[1]);
        const sourceTitle = attrOf(links[0], 'title') || textOf(links[0]);
        if (!suggestedTitle || !sourceTitle) continue;
        const targetId = Number(targetMatch[2]);
        const targetImageLink = (block.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).find((anchor) =>
          new RegExp(`/${kind}/${targetId}(?:/|\\?|$)`, 'i').test(attrOf(anchor, 'href') ?? '') &&
          /<img\b/i.test(anchor)
        );
        const targetImage = /<img\b[^>]*>/i.exec(targetImageLink ?? '')?.[0];
        const srcsetImage = attrOf(targetImage, 'data-srcset')?.split(',').at(-1)?.trim().split(/\s+/)[0];
        const imageUrl = cleanImageUrl(
          srcsetImage ??
            attrOf(targetImage, 'data-src') ??
            attrOf(targetImage, 'src')
        );
        output.push({
          id: targetId,
          title: suggestedTitle,
          imageUrl: imageUrl?.startsWith('//') ? `https:${imageUrl}` : imageUrl,
          kind,
          sourceId: Number(sourceMatch[2]),
          sourceTitle,
          description: textOf(descriptionBlock),
        });
      }
      return output;
    },
    { ttlDays: 1, force, staleWhenOffline: true }
  );
}

/** Convenience: absolute url for a MAL path (used by later phases). */
export function malUrl(path: string, params?: Record<string, string | number | undefined>): string {
  return `https://myanimelist.net/${path}${encodeQuery(params ?? {})}`;
}

/** Pulls the CSRF token from the homepage (needed for POST endpoints). */
export async function fetchCsrfToken(): Promise<string> {
  return cachedQuery(
    'scrape',
    'csrf',
    async () => {
      const html = await getPage('https://myanimelist.net/');
      const token = group1(html, /<meta name="csrf_token" content="([^"]+)"/) ?? '';
      return token;
    },
    { ttlDays: 1 }
  );
}
