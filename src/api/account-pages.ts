import { getAuth } from '@/api/auth';
import { attrOf, balancedBlocks, textOf } from '@/api/html';
import { fetchText, formBody } from '@/api/http';

const USER_AGENT = 'MALClient/3.0';

function accountCookies(): string {
  const auth = getAuth();
  if (!auth.authenticated || !auth.cookies) {
    throw new Error('Sign in to MAL to access this page.');
  }
  return auth.cookies;
}

function absoluteUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, 'https://myanimelist.net').toString();
  } catch {
    return undefined;
  }
}

function classNames(tag: string): string[] {
  return (attrOf(tag, 'class') ?? '').split(/\s+/);
}

export interface AccountMessage {
  id: string;
  threadId: string;
  replyId: string;
  sender: string;
  subject: string;
  preview: string;
  date: string;
  isRead: boolean;
  isSent: boolean;
  avatarUrl?: string;
}

export interface MessagePart {
  sender: string;
  date: string;
  content: string;
}

export async function fetchMessages(folder: 'inbox' | 'sent'): Promise<AccountMessage[]> {
  const cookies = accountCookies();
  const url = folder === 'sent'
    ? 'https://myanimelist.net/mymessages.php?go=sent'
    : 'https://myanimelist.net/mymessages.php?go=&show=0';
  const html = await fetchText(url, {
    headers: { 'User-Agent': USER_AGENT, Cookie: cookies },
  });
  return balancedBlocks(html, 'div', (open) => {
    const classes = classNames(open);
    return classes.includes('message') && classes.includes('clearfix') &&
      (folder === 'sent' ? classes.includes('spot2') : classes.includes('spot1'));
  }).flatMap((block): AccountMessage[] => {
    const anchors = block.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
    const subjectAnchor = anchors.find((anchor) =>
      classNames(anchor.slice(0, anchor.indexOf('>') + 1)).includes('subject-link')
    ) ?? anchors.find((anchor) => /[?&]go=read/i.test(attrOf(anchor.slice(0, anchor.indexOf('>') + 1), 'href') ?? ''));
    const href = attrOf(subjectAnchor?.slice(0, subjectAnchor.indexOf('>') + 1), 'href') ?? '';
    const id = /[?&]id=(\d+)/i.exec(href)?.[1];
    if (!id) return [];
    const thread = /[?&]threadid=(\d+)/i.exec(block)?.[1] ?? id;
    const reply = /[?&]replyid=(\d+)/i.exec(block)?.[1] ?? id;
    const subjectText = textOf(subjectAnchor ?? '').replace(/^\s*-\s*/, '').trim();
    const subject = subjectText || '(No subject)';
    const userBlock = balancedBlocks(block, 'div', (open) => classNames(open).includes('mym_user'))[0] ?? '';
    const previewBlock = balancedBlocks(block, 'span', (open) =>
      classNames(open).includes('mym_text')
    )[0] ?? '';
    const dateBlock = balancedBlocks(block, 'span', (open) => classNames(open).includes('mym_date'))[0] ?? '';
    const avatarTag = (block.match(/<img\b[^>]*>/i) ?? [])[0];
    const avatar = attrOf(avatarTag, 'data-src') ?? attrOf(avatarTag, 'src');
    const isRead = classNames(block.slice(0, block.indexOf('>') + 1)).includes('read');
    return [{
      id,
      threadId: thread,
      replyId: reply,
      sender: textOf(userBlock),
      subject,
      preview: textOf(previewBlock),
      date: textOf(dateBlock),
      isRead: folder === 'sent' || isRead,
      isSent: folder === 'sent',
      avatarUrl: absoluteUrl(avatar),
    }];
  });
}

export async function fetchMessageThread(message: AccountMessage): Promise<MessagePart[]> {
  const cookies = accountCookies();
  const url = `https://myanimelist.net/mymessages.php?go=read&id=${message.id}&threadid=${message.threadId}${message.isSent ? '&f=1' : ''}`;
  const html = await fetchText(url, { headers: { 'User-Agent': USER_AGENT, Cookie: cookies } });
  const history = balancedBlocks(html, 'table', (open) => classNames(open).includes('pmessage-message-history'))[0];
  if (history) {
    const parts = balancedBlocks(history, 'tr').flatMap((row): MessagePart[] => {
      const cells = balancedBlocks(row, 'td');
      if (cells.length < 3) return [];
      const content = textOf(cells[2]);
      if (!content) return [];
      return [{ date: textOf(cells[0]), sender: textOf(cells[1]), content }];
    });
    if (parts.length) return parts;
  }
  const messageBlock = balancedBlocks(html, 'td', (open) => classNames(open).includes('dialog-text'))[0] ?? '';
  const content = textOf(messageBlock);
  if (!content) throw new Error('MAL did not return readable message content.');
  return [{ sender: message.sender, date: message.date, content }];
}

export async function sendMessageReply(message: AccountMessage, content: string): Promise<void> {
  const text = content.trim();
  if (!text) throw new Error('Write a message before sending.');
  const cookies = accountCookies();
  const page = await fetchText(`https://myanimelist.net/mymessages.php?go=read&id=${message.id}&threadid=${message.threadId}`, {
    headers: { 'User-Agent': USER_AGENT, Cookie: cookies },
  });
  const tokenTag = (page.match(/<meta\b[^>]*>/gi) ?? []).find((tag) => attrOf(tag, 'name') === 'csrf_token');
  const token = attrOf(tokenTag, 'content');
  if (!token) throw new Error('MAL did not provide a security token. Sign in again and retry.');
  const url = `https://myanimelist.net/mymessages.php?go=send&replyid=${message.replyId}&threadid=${message.threadId}&toname=${encodeURIComponent(message.sender)}`;
  await fetchText(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Cookie: cookies,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `https://myanimelist.net/mymessages.php?go=read&id=${message.id}`,
    },
    body: formBody({ subject: `Re: ${message.subject}`, message: text, csrf_token: token, sendmessage: 'Send Message' }),
  });
}

export interface AccountNotification {
  id: string;
  title: string;
  content: string;
  date: string;
  imageUrl?: string;
  url?: string;
}

function assignedJson(source: string, marker: string): unknown {
  const markerAt = source.toLowerCase().indexOf(marker.toLowerCase());
  if (markerAt < 0) return undefined;
  const start = source.indexOf('{', markerAt + marker.length);
  if (start < 0) return undefined;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try {
        return JSON.parse(source.slice(start, index + 1)) as unknown;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export async function fetchAccountNotifications(): Promise<AccountNotification[]> {
  const cookies = accountCookies();
  const html = await fetchText('https://myanimelist.net/notification', {
    headers: { 'User-Agent': USER_AGENT, Cookie: cookies },
  });
  const root = assignedJson(html, 'window.MAL.notification') as { items?: unknown[] } | undefined;
  if (!root || !Array.isArray(root.items)) {
    throw new Error('MAL did not return a readable notifications feed.');
  }
  return root.items.flatMap((value): AccountNotification[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const sender = typeof item.senderName === 'string' ? item.senderName : '';
    const category = typeof item.categoryName === 'string' ? item.categoryName : '';
    const pageTitle = typeof item.pageTitle === 'string' ? item.pageTitle : '';
    const topicTitle = typeof item.topicTitle === 'string' ? item.topicTitle : '';
    const type = typeof item.typeIdentifier === 'string' ? item.typeIdentifier : '';
    const id = typeof item.id === 'string' || typeof item.id === 'number' ? String(item.id) : '';
    if (!id || item.isRead === true || item.isDeleted === true) return [];
    const description =
      (typeof item.text === 'string' && item.text) ||
      (typeof item.message === 'string' && item.message) ||
      (sender ? `${sender} — ` : '') + (topicTitle || pageTitle || category || 'MAL notification');
    const image = [item.commentUserImageUrl, item.friendImageUrl].find((candidate) => typeof candidate === 'string');
    const url = [item.url, item.pageUrl, item.topicUrl].find((candidate) => typeof candidate === 'string');
    return [{
      id,
      title: category || (type ? type.replace(/_/g, ' ') : 'Notification'),
      content: description,
      date: typeof item.createdAtForDisplay === 'string' ? item.createdAtForDisplay : '',
      imageUrl: absoluteUrl(typeof image === 'string' ? image : undefined),
      url: absoluteUrl(typeof url === 'string' ? url : undefined),
    }];
  });
}
