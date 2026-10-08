import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { attrOf, decodeEntities } from '@/api/html';
import { fetchArticleHtml } from '@/api/scrape';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { IconButton } from '@/components/ui/buttons';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

type ArticleBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }
  | { type: 'video'; url: string };

function safeMediaUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, 'https://myanimelist.net');
    if (url.protocol !== 'https:') return undefined;
    if (/(^|\.)myanimelist\.net$/i.test(url.hostname)) return url.toString();
    if (/^(?:www\.)?youtube-nocookie\.com$/i.test(url.hostname) && url.pathname.startsWith('/embed/')) {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function articleBlocks(html: string): ArticleBlock[] {
  const withMedia = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const url = safeMediaUrl(attrOf(tag, 'data-src') ?? attrOf(tag, 'src'));
      return url ? `\n[[IMAGE:${url}]]\n` : '';
    })
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (tag) => {
      const url = safeMediaUrl(attrOf(tag, 'src'));
      return url ? `\n[[VIDEO:${url}]]\n` : '';
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote|section)>/gi, '\n\n')
    .replace(/<[^>]*>/g, '');
  const tokens = decodeEntities(withMedia)
    .replace(/\r/g, '')
    .split(/(\[\[(?:IMAGE|VIDEO):https:\/\/[^\]]+\]\])/g);
  const blocks: ArticleBlock[] = [];
  for (const token of tokens) {
    const media = /^\[\[(IMAGE|VIDEO):(https:\/\/[^\]]+)\]\]$/.exec(token.trim());
    if (media) {
      blocks.push({ type: media[1] === 'IMAGE' ? 'image' : 'video', url: media[2] });
      continue;
    }
    for (const line of token.split(/\n+/)) {
      const text = line.replace(/[ \t]+/g, ' ').trim();
      if (text) blocks.push({ type: 'text', text });
    }
  }
  return blocks;
}

export function ArticleScreen() {
  const theme = useTheme();
  const openDrawer = useOpenDrawer();
  const params = useLocalSearchParams<{ url?: string; title?: string }>();
  const url = typeof params.url === 'string' ? params.url : '';
  const title = typeof params.title === 'string' ? params.title : 'Article';
  const [blocks, setBlocks] = useState<ArticleBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const content = await fetchArticleHtml(url);
        if (active) setBlocks(articleBlocks(content));
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load this article.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar
        title={title}
        onMenuPress={openDrawer}
        right={<IconButton icon="share" onPress={() => url && void Linking.openURL(url)} color="#fff" />}
      />
      {blocks.length > 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          {blocks.map((block, index) => {
            if (block.type === 'image') {
              return <RemoteImage key={`image-${index}`} uri={block.url} style={styles.image} />;
            }
            if (block.type === 'video') {
              const videoId = /\/embed\/([^/?#]+)/i.exec(block.url)?.[1];
              const videoUrl = videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : block.url;
              return (
                <Ripple
                  key={`video-${index}`}
                  onPress={() => void Linking.openURL(videoUrl)}
                  style={[styles.video, { backgroundColor: theme.brush.animeItemBackground }]}>
                  <AppText size={theme.fontSize.medium} weight="medium" color={theme.accentColor}>
                    Play embedded video
                  </AppText>
                </Ripple>
              );
            }
            return (
              <AppText
                key={`text-${index}`}
                size={theme.fontSize.medium}
                color={theme.brush.text}
                style={styles.paragraph}>
                {block.text}
              </AppText>
            );
          })}
        </ScrollView>
      ) : null}
      {error ? <EmptyState icon="newspaper" title="Could not load article" message={error} style={StyleSheet.absoluteFill} /> : null}
      <LoadingOverlay visible={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28, gap: 12 },
  paragraph: { lineHeight: 24 },
  image: { width: '100%', aspectRatio: 1.55, marginVertical: 4 },
  video: { minHeight: 54, justifyContent: 'center', alignItems: 'center', marginVertical: 4 },
});
