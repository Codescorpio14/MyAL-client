/**
 * Minimal HTML helpers — stands in for HtmlAgilityPack (which the original
 * uses for all myanimelist.net scraping). Regex + tag balancing only; the
 * MAL markup we touch is stable and simple.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  copy: '©',
  trade: '™',
  deg: '°',
  times: '×',
};

export function decodeEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

/** `InnerText` equivalent: strips tags, collapses whitespace, decodes entities. */
export function textOf(html: string | undefined): string {
  if (!html) return '';
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parses attributes of the first tag matching `re` (or of `<tag ...>`). */
export function firstTag(html: string, tagName: string): string | undefined {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, 'i');
  const m = re.exec(html);
  return m?.[0];
}

export function attrOf(tag: string | undefined, name: string): string | undefined {
  if (!tag) return undefined;
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = re.exec(tag);
  if (!m) return undefined;
  return m[2] ?? m[3] ?? m[4];
}

/** All occurrences of `re` with their full match text. */
export function matches(html: string, re: RegExp): string[] {
  const out: string[] = [];
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = global.exec(html)) !== null) {
    out.push(m[0]);
    if (m.index === global.lastIndex) global.lastIndex++;
  }
  return out;
}

/**
 * Extracts balanced `<tag …>…</tag>` blocks (nesting aware). `predicate`
 * receives each opening tag so you can filter, e.g. by class:
 *
 *   balancedBlocks(html, 'div', (t) => t.includes('js-seasonal-anime'))
 */
export function balancedBlocks(
  html: string,
  tag: string,
  predicate?: (openTag: string) => boolean
): string[] {
  const lower = html.toLowerCase();
  const openToken = `<${tag.toLowerCase()}`;
  const closeToken = `</${tag.toLowerCase()}>`;
  const blocks: string[] = [];
  let i = 0;

  const isBoundary = (pos: number) => {
    const c = lower[pos];
    return c === undefined || c === ' ' || c === '>' || c === '\n' || c === '\r' || c === '\t' || c === '/';
  };

  while (i < html.length) {
    const start = lower.indexOf(openToken, i);
    if (start === -1) break;
    if (!isBoundary(start + openToken.length)) {
      i = start + openToken.length;
      continue;
    }
    const openEnd = html.indexOf('>', start);
    if (openEnd === -1) break;
    const openTag = html.slice(start, openEnd + 1);
    if (predicate && !predicate(openTag)) {
      i = start + openToken.length;
      continue;
    }

    let depth = 0;
    let j = start;
    let end = -1;
    while (j < html.length) {
      const nextOpen = lower.indexOf(openToken, j);
      const nextClose = lower.indexOf(closeToken, j);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose && isBoundary(nextOpen + openToken.length)) {
        depth++;
        j = nextOpen + openToken.length;
      } else {
        depth--;
        j = nextClose + closeToken.length;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) break;
    blocks.push(html.slice(start, end));
    i = end;
  }
  return blocks;
}

/** Grabs group 1 of the first match. */
export function group1(html: string, re: RegExp): string | undefined {
  const m = re.exec(html);
  return m?.[1];
}

/** `/anime/1234/Title` → 1234 */
export function idFromHref(href: string | undefined, kind: 'anime' | 'manga'): number | undefined {
  if (!href) return undefined;
  const m = new RegExp(`/${kind}/(\\d+)`).exec(href);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Strips query strings from CDN urls (original does this everywhere). */
export function cleanImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}
