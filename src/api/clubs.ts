import { cachedQuery } from '@/api/cache';
import { getAuth } from '@/api/auth';
import { attrOf, balancedBlocks, cleanImageUrl, group1, textOf } from '@/api/html';
import { fetchText, formBody } from '@/api/http';

export interface ClubDetailItem {
  label: string;
  value: string;
  href?: string;
}

export interface ClubComment {
  id: string;
  username: string;
  avatarUrl?: string;
  date: string;
  content: string;
}

export interface ClubDetails {
  id: string;
  name: string;
  imageUrl?: string;
  description: string;
  isPublic: boolean;
  isMember: boolean;
  canJoin: boolean;
  canRequest: boolean;
  generalInfo: ClubDetailItem[];
  officers: ClubDetailItem[];
  animeRelations: ClubDetailItem[];
  mangaRelations: ClubDetailItem[];
  characterRelations: ClubDetailItem[];
  members: ClubDetailItem[];
  comments: ClubComment[];
}

function classes(tag: string): string[] {
  return (attrOf(tag, 'class') ?? '').split(/\s+/);
}

function imageUrl(html: string): string | undefined {
  const image = /<img\b[^>]*>/i.exec(html)?.[0];
  const url = attrOf(image, 'data-src') ?? attrOf(image, 'src');
  return cleanImageUrl(url?.startsWith('//') ? `https:${url}` : url);
}

function hrefOf(html: string): string | undefined {
  const anchor = /<a\b[^>]*>/i.exec(html)?.[0];
  const href = attrOf(anchor, 'href');
  if (!href) return undefined;
  try {
    return new URL(href, 'https://myanimelist.net').toString();
  } catch {
    return undefined;
  }
}

function parseClubDetails(html: string, id: string): ClubDetails {
  const name = textOf(balancedBlocks(html, 'h1')[0]);
  if (!name) throw new Error('MAL did not return a readable club page.');

  const headerIndex = html.search(/class=["'][^"']*\bclub-information-header\b/i);
  const descriptionSource = headerIndex < 0 ? '' : html.slice(headerIndex);
  const descriptionHtml = balancedBlocks(descriptionSource, 'div', (open) =>
    classes(open).includes('clearfix')
  )[0] ?? '';

  const sectionHeaders = balancedBlocks(html, 'div', (open) => classes(open).includes('normal_header'));
  const generalInfo: ClubDetailItem[] = [];
  const officers: ClubDetailItem[] = [];
  const animeRelations: ClubDetailItem[] = [];
  const mangaRelations: ClubDetailItem[] = [];
  const characterRelations: ClubDetailItem[] = [];
  let section = '';
  let cursor = 0;
  for (const header of sectionHeaders) {
    const index = html.indexOf(header, cursor);
    if (index < 0) continue;
    const end = html.indexOf('<div', index + header.length);
    const nextHeader = html.indexOf('normal_header', index + header.length);
    const sectionEnd = nextHeader < 0 ? html.length : html.lastIndexOf('<div', nextHeader);
    const content = html.slice(end < 0 ? index + header.length : end, Math.max(end, sectionEnd));
    section = textOf(header).toLowerCase();
    const items = balancedBlocks(content, 'div', (open) =>
      classes(open).some((name) => name === 'spaceit_pad' || name === 'borderClass')
    );
    for (const item of items) {
      const text = textOf(item);
      if (!text || /pictures/i.test(text)) continue;
      const link = hrefOf(item);
      const anchorText = textOf((item.match(/<a\b[^>]*>[\s\S]*?<\/a>/i) ?? [])[0] ?? '');
      if (section.includes('club stats')) {
        const split = text.indexOf(':');
        if (split > 0) generalInfo.push({ label: text.slice(0, split).trim(), value: text.slice(split + 1).trim() });
      } else if (section.includes('club officers') && anchorText) {
        officers.push({ label: text.replace(anchorText, '').replace(/[()]/g, '').trim() || 'Officer', value: anchorText, href: link });
      } else if (section.includes('anime relations') && anchorText) {
        animeRelations.push({ label: 'Anime', value: anchorText, href: link });
      } else if (section.includes('manga relations') && anchorText) {
        mangaRelations.push({ label: 'Manga', value: anchorText, href: link });
      } else if (section.includes('character relations') && anchorText) {
        characterRelations.push({ label: 'Character', value: anchorText, href: link });
      }
    }
    cursor = index + header.length;
  }

  const comments = balancedBlocks(html, 'div', (open) =>
    (attrOf(open, 'id') ?? '').includes('comment')
  ).flatMap((block): ClubComment[] => {
    const commentId = attrOf(block.slice(0, block.indexOf('>') + 1), 'id') ?? '';
    const cells = balancedBlocks(block, 'td');
    const body = cells.at(-1) ?? block;
    const userLink = (body.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).find((anchor) =>
      /\/profile\//i.test(attrOf(anchor.slice(0, anchor.indexOf('>') + 1), 'href') ?? '')
    );
    const username = textOf(userLink ?? '');
    if (!username) return [];
    const detail = textOf(body);
    const date = /(\w{3,9}\s+\d{1,2},?\s+\d{4}[^|]*)/.exec(detail)?.[1]?.trim() ?? '';
    const content = detail.replace(username, '').replace(date, '').replace(/\|\s*/, '').trim();
    return [{
      id: /(\d+)/.exec(commentId)?.[1] ?? commentId,
      username,
      avatarUrl: imageUrl(block),
      date,
      content,
    }];
  });

  const rightSideStart = html.search(/club stats|club officers|anime relations|manga relations/i);
  const rightSide = rightSideStart < 0 ? html : html.slice(Math.max(0, rightSideStart - 5000));
  const isMember = /\b(?:Leave Club|submitleave)\b/i.test(textOf(rightSide)) || /name=["']submitleave["']/i.test(rightSide);
  const canJoin = /\bJoin Club\b/i.test(textOf(rightSide)) || /action=join/i.test(rightSide);
  const canRequest = /\bRequest Access\b/i.test(textOf(rightSide)) || /action=request/i.test(rightSide);
  const memberTable = balancedBlocks(html, 'table').find((table) =>
    /\/profile\//i.test(table) && /userimages|useravatars/i.test(table)
  ) ?? '';
  const members = balancedBlocks(memberTable, 'td').flatMap((cell): ClubDetailItem[] => {
    const username = textOf((cell.match(/<a\b[^>]*>[\s\S]*?<\/a>/i) ?? [])[0] ?? '');
    return username ? [{ label: 'Member', value: username, href: hrefOf(cell) }] : [];
  }).slice(0, 12);
  const clubImage = (html.match(/<img\b[^>]*>/gi) ?? []).find((tag) =>
    /\/clubs\//i.test(attrOf(tag, 'data-src') ?? attrOf(tag, 'src') ?? '')
  );

  return {
    id,
    name,
    imageUrl: cleanImageUrl(attrOf(clubImage, 'data-src') ?? attrOf(clubImage, 'src')),
    description: textOf(descriptionHtml),
    isPublic: !/This is a private club/i.test(textOf(html)),
    isMember,
    canJoin,
    canRequest,
    generalInfo,
    officers,
    animeRelations,
    mangaRelations,
    characterRelations,
    members,
    comments,
  };
}

export async function fetchClubDetails(id: string, force = false): Promise<ClubDetails> {
  if (!/^\d+$/.test(id)) throw new Error('Invalid MAL club id.');
  const auth = getAuth();
  const accountKey = auth.authenticated ? auth.username.toLowerCase() : 'guest';
  return cachedQuery(
    'scrape',
    `native_club_details_${id}_${accountKey}`,
    async () => {
      const cookies = auth.cookies;
      const html = await fetchText(`https://myanimelist.net/clubs.php?cid=${id}`, {
        headers: {
          'User-Agent': 'MALClient/3.0',
          ...(cookies ? { Cookie: cookies } : {}),
        },
      });
      return parseClubDetails(html, id);
    },
    { ttlDays: 0.1, force, staleWhenOffline: true }
  );
}

async function clubCsrfToken(id: string): Promise<string> {
  const cookies = getAuth().cookies;
  if (!getAuth().authenticated || !cookies) {
    throw new Error('Sign in to MAL to interact with clubs.');
  }
  const html = await fetchText(`https://myanimelist.net/clubs.php?cid=${id}`, {
    headers: { 'User-Agent': 'MALClient/3.0', Cookie: cookies },
  });
  const token = group1(html, /<meta\b[^>]*name=["']csrf_token["'][^>]*content=["']([^"']+)["']/i);
  if (!token) throw new Error('MAL did not provide a security token. Sign in again and retry.');
  return token;
}

async function postClubAction(id: string, action: 'join' | 'request' | 'leave' | 'comment', value = ''): Promise<void> {
  if (!/^\d+$/.test(id)) throw new Error('Invalid MAL club id.');
  const token = await clubCsrfToken(id);
  const cookies = getAuth().cookies;
  const endpoint = action === 'comment'
    ? `https://myanimelist.net/clubs.php?cid=${id}`
    : `https://myanimelist.net/clubs.php?action=${action}&id=${id}`;
  const body = action === 'comment'
    ? { commentText: value.trim(), commentSubmit: 'Submit Comment', csrf_token: token }
    : action === 'leave'
      ? { submitleave: 'Leave Club', csrf_token: token }
      : { submitjoin: action === 'request' ? 'Request Access' : 'Join Club', csrf_token: token };
  const response = await fetchText(endpoint, {
    method: 'POST',
    headers: {
      'User-Agent': 'MALClient/3.0',
      Cookie: cookies,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `https://myanimelist.net/clubs.php?cid=${id}`,
    },
    body: formBody(body),
  });
  if (/class=["'][^"']*\bbadresult\b/i.test(response)) {
    throw new Error('MAL rejected the club action. Check your membership and try again.');
  }
}

export function joinClub(id: string, request = false): Promise<void> {
  return postClubAction(id, request ? 'request' : 'join');
}

export function leaveClub(id: string): Promise<void> {
  return postClubAction(id, 'leave');
}

export function postClubComment(id: string, comment: string): Promise<void> {
  const value = comment.trim();
  if (!value) throw new Error('Write a comment before sending.');
  return postClubAction(id, 'comment', value);
}
