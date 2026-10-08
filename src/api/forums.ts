import { cachedQuery } from '@/api/cache';
import { getAuth } from '@/api/auth';
import { attrOf, balancedBlocks, textOf } from '@/api/html';
import { fetchText, formBody } from '@/api/http';

export interface ForumTopicPreview {
  id: string;
  title: string;
  username: string;
  avatarUrl?: string;
  date: string;
  boardName?: string;
  replies?: string;
  lastPoster?: string;
  lastPostDate?: string;
}

export interface ForumBoard {
  id: number;
  title: string;
  description: string;
  category: string;
  previews: ForumTopicPreview[];
}

export interface ForumBoardGroup {
  title: string;
  boards: ForumBoard[];
}

export interface ForumMessage {
  id: string;
  username: string;
  avatarUrl?: string;
  date: string;
  body: string;
}

export interface ForumThread {
  id: string;
  title: string;
  messages: ForumMessage[];
}

const USER_AGENT = 'MALClientRN/1.0 (native forums)';

function hasClass(tag: string, name: string): boolean {
  return (attrOf(tag, 'class') ?? '').split(/\s+/).includes(name);
}

function absoluteUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, 'https://myanimelist.net');
    return parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function topicFromPreview(html: string): ForumTopicPreview | undefined {
  const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  const titleLink = anchors.find((anchor) =>
    hasClass(anchor.slice(0, anchor.indexOf('>') + 1), 'topic-title-link')
  );
  const href = attrOf(titleLink?.slice(0, titleLink.indexOf('>') + 1), 'href');
  const id = href ? /[?&]topicid=(\d+)/i.exec(href)?.[1] : undefined;
  const title = titleLink ? textOf(titleLink) : '';
  if (!id || !title) return undefined;

  const avatarAnchor = anchors.find((anchor) => /profile\//i.test(attrOf(anchor.slice(0, anchor.indexOf('>') + 1), 'href') ?? ''));
  const avatar = /<img\b[^>]*>/i.exec(avatarAnchor ?? '')?.[0];
  const info = balancedBlocks(html, 'span', (open) => hasClass(open, 'date') && hasClass(open, 'di-ib'))[0] ?? '';
  const usernameLink = (info.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).find((anchor) =>
    /profile\//i.test(attrOf(anchor.slice(0, anchor.indexOf('>') + 1), 'href') ?? '')
  );

  return {
    id,
    title,
    username: usernameLink ? textOf(usernameLink) : '',
    avatarUrl: absoluteUrl(attrOf(avatar, 'data-src') ?? attrOf(avatar, 'src')),
    date: textOf(info.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, '').replace(/<[^>]*>/g, ' ')).replace(/»+$/, '').trim(),
  };
}

function parseBoards(html: string): ForumBoardGroup[] {
  const groups: ForumBoardGroup[] = [];
  const groupBlocks = balancedBlocks(html, 'div', (open) => hasClass(open, 'forum-board-list'));

  for (const groupHtml of groupBlocks) {
    const header = /<div\b[^>]*class=["'][^"']*\bforum-header\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(groupHtml)?.[1];
    const groupTitle = textOf(header);
    if (!groupTitle) continue;
    const boards = balancedBlocks(groupHtml, 'div', (open) => hasClass(open, 'forum-board'))
      .flatMap((boardHtml): ForumBoard[] => {
        const boardLink = (boardHtml.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).find((anchor) =>
          hasClass(anchor.slice(0, anchor.indexOf('>') + 1), 'forum-board-title')
        );
        if (!boardLink) return [];
        const href = attrOf(boardLink.slice(0, boardLink.indexOf('>') + 1), 'href') ?? '';
        const id = Number(/[?&]board=(\d+)/i.exec(href)?.[1]);
        const title = textOf(boardLink);
        if (!Number.isSafeInteger(id) || id <= 0 || !title) return [];
        const description = textOf(
          /<span\b[^>]*class=["'][^"']*\bforum-board-description\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(boardHtml)?.[1]
        );
        const topicsList = balancedBlocks(boardHtml, 'ul', (open) => hasClass(open, 'topics'))[0] ?? '';
        const previews = balancedBlocks(topicsList, 'li')
          .map(topicFromPreview)
          .filter((topic): topic is ForumTopicPreview => Boolean(topic));
        return [{ id, title, description, category: groupTitle, previews }];
      });
    if (boards.length) groups.push({ title: groupTitle, boards });
  }
  return groups;
}

function topicFromTableRow(row: string, boardName?: string): ForumTopicPreview | undefined {
  const anchors = row.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  const titleLink = anchors.find((anchor) => /[?&]topicid=\d+/i.test(attrOf(anchor.slice(0, anchor.indexOf('>') + 1), 'href') ?? ''));
  if (!titleLink) return undefined;
  const href = attrOf(titleLink.slice(0, titleLink.indexOf('>') + 1), 'href') ?? '';
  const id = /[?&]topicid=(\d+)/i.exec(href)?.[1];
  const title = textOf(titleLink);
  if (!id || !title) return undefined;
  const cells = balancedBlocks(row, 'td');
  const avatar = /<img\b[^>]*>/i.exec(row)?.[0];
  const profileLink = anchors.find((anchor) => /\/profile\//i.test(attrOf(anchor.slice(0, anchor.indexOf('>') + 1), 'href') ?? ''));
  const stats = cells.map(textOf);
  return {
    id,
    title,
    username: profileLink ? textOf(profileLink) : '',
    avatarUrl: absoluteUrl(attrOf(avatar, 'data-src') ?? attrOf(avatar, 'src')),
    date: stats[1] ?? '',
    boardName,
    replies: stats[2],
    lastPoster: textOf(cells[3] ?? ''),
    lastPostDate: textOf(cells[3] ?? ''),
  };
}

export async function fetchForumBoards(force = false): Promise<ForumBoardGroup[]> {
  return cachedQuery(
    'scrape',
    'native_forum_boards_v1',
    async () => {
      const html = await fetchText('https://myanimelist.net/forum/', { headers: { 'User-Agent': USER_AGENT } });
      const groups = parseBoards(html);
      if (!groups.length) throw new Error('MAL forum boards could not be parsed.');
      return groups;
    },
    { ttlDays: 1, force, staleWhenOffline: true }
  );
}

export async function fetchForumTopics(board: ForumBoard, force = false): Promise<ForumTopicPreview[]> {
  return cachedQuery(
    'scrape',
    `native_forum_topics_${board.id}`,
    async () => {
      const html = await fetchText(`https://myanimelist.net/forum/?board=${board.id}`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      const table = balancedBlocks(html, 'table', (open) => attrOf(open, 'id') === 'forumTopics')[0] ?? '';
      return balancedBlocks(table, 'tr')
        .slice(1)
        .map((row) => topicFromTableRow(row, board.title))
        .filter((topic): topic is ForumTopicPreview => Boolean(topic));
    },
    { ttlDays: 0.25, force, staleWhenOffline: true }
  );
}

export async function fetchForumThread(id: string, title: string, force = false): Promise<ForumThread> {
  if (!/^\d+$/.test(id)) throw new Error('Invalid forum topic id.');
  return cachedQuery(
    'scrape',
    `native_forum_thread_${id}`,
    async () => {
      const html = await fetchText(`https://myanimelist.net/forum/?topicid=${id}`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      const messages = balancedBlocks(html, 'div', (open) =>
        hasClass(open, 'forum-topic-message')
      ).flatMap((block): ForumMessage[] => {
        const open = block.slice(0, block.indexOf('>') + 1);
        const messageId =
          attrOf(open, 'data-id') ??
          /forumMsg(\d+)/i.exec(attrOf(open, 'id') ?? '')?.[1] ??
          '';
        const usernameTag = balancedBlocks(block, 'div', (tag) => hasClass(tag, 'username'))[0];
        const profileLink = (block.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).find((anchor) =>
          /\/profile\//i.test(attrOf(anchor.slice(0, anchor.indexOf('>') + 1), 'href') ?? '')
        );
        const username = attrOf(open, 'data-user') || textOf(usernameTag) || textOf(profileLink ?? '');
        const date = /<div\b[^>]*class=["'][^"']*\bdate\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(block)?.[1];
        const profile = balancedBlocks(block, 'div', (open) => hasClass(open, 'profile'))[0] ?? block;
        const avatar = /<img\b[^>]*>/i.exec(profile)?.[0];
        const content = balancedBlocks(block, 'div', (open) => hasClass(open, 'content'))[0] ?? '';
        const bodyTable = balancedBlocks(content, 'table', (open) => hasClass(open, 'body'))[0] ?? '';
        const body = textOf(bodyTable || content)
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (!messageId || !username || !body) return [];
        return [{
          id: messageId,
          username,
          avatarUrl: absoluteUrl(attrOf(avatar, 'data-src') ?? attrOf(avatar, 'src')),
          date: textOf(date),
          body: body.length > 4000 ? `${body.slice(0, 4000)}…` : body,
        }];
      });
      if (!messages.length) throw new Error('MAL did not return any readable posts for this topic.');
      return { id, title, messages };
    },
    { ttlDays: 0.1, force, staleWhenOffline: true }
  );
}

function csrfTokenFrom(html: string): string {
  const meta = (html.match(/<meta\b[^>]*>/gi) ?? []).find((tag) => attrOf(tag, 'name') === 'csrf_token');
  return attrOf(meta, 'content') ?? '';
}

async function authenticatedForumPage(url: string): Promise<{ html: string; cookies: string; token: string }> {
  const auth = getAuth();
  if (!auth.authenticated || !auth.cookies) {
    throw new Error('Sign in to MAL to post in the forums.');
  }
  const html = await fetchText(url, {
    headers: { 'User-Agent': USER_AGENT, Cookie: auth.cookies },
  });
  const token = csrfTokenFrom(html);
  if (!token) throw new Error('MAL did not provide a security token. Sign in again and retry.');
  return { html, cookies: auth.cookies, token };
}

export async function postForumReply(topicId: string, message: string): Promise<void> {
  if (!/^\d+$/.test(topicId)) throw new Error('Invalid forum topic id.');
  const text = message.trim();
  if (!text) throw new Error('Write a reply before sending.');
  const topicUrl = `https://myanimelist.net/forum/?action=message&topic_id=${topicId}`;
  const { cookies, token } = await authenticatedForumPage(`https://myanimelist.net/forum/?topicid=${topicId}`);
  const response = await fetchText(topicUrl, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Cookie: cookies,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `https://myanimelist.net/forum/?topicid=${topicId}`,
    },
    body: formBody({ msg_text: text, csrf_token: token, action_type: 'submit' }),
  });
  if (/class=["'][^"']*\bbadresult\b/i.test(response)) {
    throw new Error('MAL rejected this reply. Check the message and try again.');
  }
}

export async function createForumTopic(boardId: number, title: string, message: string): Promise<string | undefined> {
  if (!Number.isSafeInteger(boardId) || boardId <= 0) throw new Error('Invalid forum board id.');
  const topicTitle = title.trim();
  const text = message.trim();
  if (!topicTitle || !text) throw new Error('Enter both a topic title and message.');
  const endpoint = `https://myanimelist.net/forum/?action=post&boardid=${boardId}`;
  const { cookies, token } = await authenticatedForumPage(`https://myanimelist.net/forum/?board=${boardId}`);
  const response = await fetchText(endpoint, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Cookie: cookies,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `https://myanimelist.net/forum/?board=${boardId}`,
    },
    body: formBody({ topic_title: topicTitle, msg_text: text, csrf_token: token, submit: 'Submit' }),
  });
  if (/class=["'][^"']*\bbadresult\b/i.test(response)) {
    throw new Error('MAL rejected this topic. Check the title and message and try again.');
  }
  return /[?&]topicid=(\d+)/i.exec(response)?.[1];
}

export async function fetchRecentForumTopics(force = false): Promise<ForumTopicPreview[]> {
  return cachedQuery(
    'scrape',
    'native_forum_recent_v1',
    async () => {
      const html = await fetchText('https://myanimelist.net/forum/', { headers: { 'User-Agent': USER_AGENT } });
      return balancedBlocks(html, 'div', (open) => hasClass(open, 'forum-side-block'))
        .flatMap((block): ForumTopicPreview[] =>
          balancedBlocks(block, 'li')
            .flatMap((row): ForumTopicPreview[] => {
              const anchors = row.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
              const titleLink = anchors.find((anchor) =>
                hasClass(anchor.slice(0, anchor.indexOf('>') + 1), 'title')
              );
              const href = attrOf(titleLink?.slice(0, titleLink.indexOf('>') + 1), 'href');
              const id = href ? /[?&]topicid=(\d+)/i.exec(href)?.[1] : undefined;
              const title = titleLink ? textOf(titleLink) : '';
              if (!id || !title) return [];
              const info = balancedBlocks(row, 'span', (open) => hasClass(open, 'information'))[0] ?? '';
              const profileLink = (info.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [])[0];
              const avatar = /<img\b[^>]*>/i.exec(row)?.[0];
              return [{
                id,
                title,
                username: profileLink ? textOf(profileLink) : '',
                avatarUrl: absoluteUrl(attrOf(avatar, 'data-src') ?? attrOf(avatar, 'src')),
                date: textOf(info),
              }];
            })
        );
    },
    { ttlDays: 0.25, force, staleWhenOffline: true }
  );
}
