import { cachedQuery } from '@/api/cache';
import { attrOf, balancedBlocks, cleanImageUrl, group1, textOf } from '@/api/html';
import { fetchText, RequestGate, withRetries } from '@/api/http';

const gate = new RequestGate(250);

async function malPage(path: string): Promise<string> {
  return gate.run(() =>
    withRetries(
      () => fetchText(`https://myanimelist.net/${path}`, { headers: { 'User-Agent': 'MALClient/3.0' } }),
      3
    )
  );
}

export interface ScrappedEntry {
  id: number;
  title: string;
  kind: 'anime' | 'manga';
  imageUrl?: string;
  notes?: string;
}

export interface ScrappedPerson {
  id: number;
  name: string;
  imageUrl?: string;
  details: string[];
  credits: ScrappedEntry[];
}

export interface ScrappedCharacter extends ScrappedPerson {
  biography: string;
  spoilers: string;
  voiceActors: ScrappedPerson[];
  animeography: ScrappedEntry[];
  mangaography: ScrappedEntry[];
}

function imageFrom(block: string): string | undefined {
  const tag = /<img\b[^>]*>/i.exec(block)?.[0];
  const source = attrOf(tag, 'data-src') ?? attrOf(tag, 'src');
  if (!source || source.includes('questionmark')) return undefined;
  return cleanImageUrl(source.replace(/\/r\/\d+x\d+/, ''));
}

function heading(html: string): string {
  const raw = group1(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ?? '';
  return textOf(raw).split('\n')[0].trim();
}

function metaImage(html: string): string | undefined {
  const tag = /<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/i.exec(html)?.[0];
  return attrOf(tag, 'content');
}

function metaDescription(html: string): string {
  const tag = /<meta\b[^>]*name=["']description["'][^>]*>/i.exec(html)?.[0];
  return textOf(attrOf(tag, 'content'));
}

function entryFromRow(row: string): ScrappedEntry | undefined {
  const anchors = row.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  const link = anchors.find((a) => /href=["'][^"']*\/(anime|manga)\/\d+/i.test(a));
  if (!link) return undefined;
  const href = attrOf(link, 'href') ?? '';
  const match = /\/(anime|manga)\/(\d+)/i.exec(href);
  const id = match ? Number(match[2]) : NaN;
  const titleLink = anchors.find((a) => a !== link && textOf(a).length > 0);
  const title = textOf(titleLink ?? link);
  if (!Number.isSafeInteger(id) || !title) return undefined;
  const notes = textOf(row.replace(link, '').replace(titleLink ?? '', ''));
  return { id, title, kind: match?.[1].toLowerCase() === 'manga' ? 'manga' : 'anime', imageUrl: imageFrom(row), notes };
}

function entriesIn(html: string): ScrappedEntry[] {
  const rows = balancedBlocks(html, 'tr');
  const entries = new Map<string, ScrappedEntry>();
  for (const row of rows) {
    const entry = entryFromRow(row);
    if (entry) entries.set(`${entry.kind}:${entry.id}`, entry);
  }
  return [...entries.values()];
}

function voiceActorsIn(html: string): ScrappedPerson[] {
  const people = new Map<number, ScrappedPerson>();
  for (const row of balancedBlocks(html, 'tr')) {
    const anchor = (row.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).find((a) =>
      /href=["'][^"']*\/people\/\d+/i.test(a)
    );
    if (!anchor) continue;
    const idMatch = /\/people\/(\d+)/i.exec(attrOf(anchor, 'href') ?? '');
    const name = textOf(anchor);
    const id = idMatch ? Number(idMatch[1]) : NaN;
    if (!Number.isSafeInteger(id) || !name || people.has(id)) continue;
    people.set(id, { id, name, imageUrl: imageFrom(row), details: [], credits: [] });
  }
  return [...people.values()];
}

function biographyFrom(html: string): { biography: string; spoilers: string } {
  const table = balancedBlocks(html, 'table')[0] ?? '';
  const cells = balancedBlocks(table, 'td');
  const content = cells[1] ?? table;
  const spoilerBlocks = balancedBlocks(content, 'div', (open) => /class=["'][^"']*\bspoiler\b/i.test(open));
  let cleanContent = content;
  for (const block of spoilerBlocks) cleanContent = cleanContent.replace(block, ' ');
  cleanContent = cleanContent.replace(/<table\b[\s\S]*?<\/table>/gi, ' ');
  const biography = textOf(cleanContent)
    .replace(/^.*?(?:Biography|Profile)\s*/i, '')
    .trim();
  return { biography, spoilers: spoilerBlocks.map(textOf).filter(Boolean).join('\n\n') };
}

export function fetchCharacterDetails(id: number): Promise<ScrappedCharacter> {
  return cachedQuery(
    'scrape',
    `character_details_${id}`,
    async () => {
      const html = await malPage(`character/${id}`);
      const table = balancedBlocks(html, 'table')[0] ?? '';
      const cells = balancedBlocks(table, 'td');
      const left = cells[0] ?? html;
      const { biography, spoilers } = biographyFrom(html);
      const entries = entriesIn(left);
      const voiceActors = voiceActorsIn(cells[1] ?? html);
      const favs = /([\d,]+)\s+favorites?/i.exec(html)?.[1];
      return {
        id,
        name: heading(html),
        imageUrl: imageFrom(left) ?? metaImage(html),
        details: favs ? [`${favs} favorites`] : [],
        credits: [],
        biography: biography || metaDescription(html),
        spoilers,
        voiceActors,
        animeography: entries.filter((entry) => entry.kind === 'anime'),
        mangaography: entries.filter((entry) => entry.kind === 'manga'),
      };
    },
    { ttlDays: 30 }
  );
}

export function fetchPersonDetails(id: number): Promise<ScrappedPerson> {
  return cachedQuery(
    'scrape',
    `person_details_${id}`,
    async () => {
      const html = await malPage(`people/${id}`);
      const table = balancedBlocks(html, 'table')[0] ?? '';
      const cells = balancedBlocks(table, 'td');
      const left = cells[0] ?? html;
      const detailBlocks = balancedBlocks(left, 'div', (open) => /class=["'][^"']*\bspaceit_pad\b/i.test(open));
      const details = detailBlocks.map(textOf).filter(Boolean);
      const credits = entriesIn(cells[1] ?? html);
      return {
        id,
        name: heading(html),
        imageUrl: imageFrom(left) ?? metaImage(html),
        details: details.length ? details : [metaDescription(html)].filter(Boolean),
        credits,
      };
    },
    { ttlDays: 30 }
  );
}
