import { RequestGate, withRetries } from '@/api/http';

/**
 * Endpoints that are not covered by the shared api layer (staff, episodes,
 * themes parsing) for the details screen.
 */

const TENRAI_BASE = 'https://api.tenrai.org/v1';
const MAL_UA = 'MALClient/3.0';

const tenraiGate = new RequestGate(500);

function tenraiFetch<T>(path: string): Promise<T> {
  return withRetries(
    () =>
      tenraiGate.run(async () => {
        const res = await fetch(`${TENRAI_BASE}${path}`, {
          headers: { Accept: 'application/json', 'User-Agent': MAL_UA },
        });
        if (!res.ok) {
          throw new Error(`Tenrai request failed: ${res.status}`);
        }
        return (await res.json()) as T;
      }),
    4,
  );
}

/** Minimal shape of a Jikan/Tenrai character entry. */
interface RawCharacter {
  character?: { mal_id?: number; name?: string; images?: { jpg?: { image_url?: string } } };
  role?: string;
  voice_actors?: {
    person?: { mal_id?: number; name?: string; images?: { jpg?: { image_url?: string } } };
    language?: string;
  }[];
}

export interface CharacterActorPair {
  characterId?: number;
  characterName: string;
  characterImage?: string;
  characterRole?: string;
  actorId?: number;
  actorName: string;
  actorImage?: string;
  actorLanguage?: string;
  unknown?: boolean;
}

export interface StaffMember {
  id?: number;
  name: string;
  image?: string;
  positions: string[];
}

export interface StaffPosition {
  name: string;
  people: StaffMember[];
}

export interface StaffGroup {
  positions: StaffPosition[];
}

/** Fetch the cast for the given media; one call yields both characters and staff. */
export async function fetchCast(kind: 'anime' | 'manga', id: number): Promise<{
  characters: CharacterActorPair[];
  staff: StaffGroup;
}> {
  const raw = await tenraiFetch<{ data?: RawCharacter[] }>(`/${kind}/${id}/characters`);
  const rows = Array.isArray(raw?.data) ? raw.data : [];

  const characters: CharacterActorPair[] = [];
  const staffPeople = new Map<string, StaffMember>();
  const positionMap = new Map<string, StaffPosition>();
  let cap = 0;

  for (const row of rows) {
    if (cap > 30) break;
    cap += 1;
    const character = row.character;
    const characterName = character?.name ?? 'Unknown';
    const characterImage = character?.images?.jpg?.image_url;
    const voiceActors = Array.isArray(row.voice_actors) ? row.voice_actors : [];
    const va = voiceActors[0];
    const actorName = va?.person?.name;
    characters.push({
      characterName,
      characterId: character?.mal_id,
      characterImage,
      characterRole: row.role,
      actorName: actorName ?? 'Unknown',
      actorId: va?.person?.mal_id,
      actorImage: va?.person?.images?.jpg?.image_url,
      actorLanguage: va?.language,
      unknown: actorName == null,
    });
  }

  // Staff: positions list lives alongside characters in this payload; fall back
  // to deriving nothing when absent (manga / incomplete responses).
  const staffRaw = raw as unknown as { staff?: { mal_id?: number; name?: string; images?: { jpg?: { image_url?: string } }; positions?: string[] }[] };
  const staffRows = Array.isArray(staffRaw.staff) ? staffRaw.staff : [];
  let sCap = 0;
  for (const row of staffRows) {
    if (sCap > 30) break;
    sCap += 1;
    const name = row?.name;
    if (!name) continue;
    const member: StaffMember = {
      id: row.mal_id,
      name,
      image: row.images?.jpg?.image_url,
      positions: Array.isArray(row.positions) ? row.positions : [],
    };
    staffPeople.set(name, member);
    for (const position of member.positions) {
      let group = positionMap.get(position);
      if (!group) {
        group = { name: position, people: [] };
        positionMap.set(position, group);
      }
      if (!group.people.some((p) => p.name === name)) group.people.push(member);
    }
  }

  return {
    characters,
    staff: { positions: Array.from(positionMap.values()).sort((a, b) => a.name.localeCompare(b.name)) },
  };
}

export interface EpisodeRowData {
  id: number;
  title: string;
  filler?: boolean;
  recap?: boolean;
  url?: string;
  forumUrl?: string;
  titleJapanese?: string;
  titleRomaji?: string;
}

interface RawEpisode {
  mal_id?: number;
  title?: string;
  filler?: boolean;
  recap?: boolean;
  url?: string;
  forum_url?: string;
  title_japanese?: string | null;
  title_romaji?: string | null;
}

/** Fetch up to 10 pages of episodes (mirrors AnimeEpisodesQuery). */
export async function fetchEpisodes(id: number): Promise<EpisodeRowData[]> {
  const out: EpisodeRowData[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await tenraiFetch<{ data?: RawEpisode[]; pagination?: { has_next_page?: boolean } }>(
      `/anime/${id}/episodes?page=${page}`,
    );
    const rows = Array.isArray(res?.data) ? res.data : [];
    for (const ep of rows) {
      if (ep?.mal_id == null) continue;
      out.push({
        id: ep.mal_id,
        title: ep.title ?? '',
        filler: ep.filler,
        recap: ep.recap,
        url: ep.url,
        forumUrl: ep.forum_url,
        titleJapanese: ep.title_japanese ?? undefined,
        titleRomaji: ep.title_romaji ?? undefined,
      });
    }
    if (!res?.pagination?.has_next_page || rows.length === 0) break;
  }
  return out;
}

export interface ThemeList {
  openings: string[];
  endings: string[];
}

/** OP/ED lists from Tenrai (/anime/{id}/themes → {data:{openings,endings}}). */
export async function fetchThemes(id: number): Promise<ThemeList> {
  try {
    const res = await tenraiFetch<{ data?: { openings?: string[]; endings?: string[] } }>(
      `/anime/${id}/themes`,
    );
    const data = res?.data;
    return {
      openings: Array.isArray(data?.openings) ? data.openings : [],
      endings: Array.isArray(data?.endings) ? data.endings : [],
    };
  } catch {
    return { openings: [], endings: [] };
  }
}
