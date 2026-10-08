import { DrawerActions } from 'expo-router/react-navigation';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { AppIcon, IconName } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { Fab } from '@/components/ui/buttons';
import { Flyout, FlyoutItem, FlyoutRect, measureAnchor } from '@/components/ui/flyout';
import { Ripple } from '@/components/ui/ripple';
import { TOP_ANIME_TYPES, TOP_MANGA_TYPES } from '@/api/types';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme/theme-context';

type MoreKind = 'animeStatus' | 'topAnime' | 'mangaStatus' | 'topManga';

interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  href: string;
  more?: MoreKind;
}

/** `StatusToString(i, isManga)` — exact labels incl. the "All" entry. */
function statusLabels(isManga: boolean): { key: string; label: string }[] {
  return [
    { key: 'watching', label: isManga ? 'Reading' : 'Watching' },
    { key: 'completed', label: 'Completed' },
    { key: 'on_hold', label: 'On hold' },
    { key: 'dropped', label: 'Dropped' },
    { key: isManga ? 'plan_to_read' : 'plan_to_watch', label: isManga ? 'Plan to read' : 'Plan to watch' },
    { key: 'all', label: 'All' },
  ];
}

const ANIME_ITEMS: NavItem[] = [
  { key: 'anime', label: 'Anime list', icon: 'list', href: '/anime-list?mode=Anime', more: 'animeStatus' },
  { key: 'seasonal', label: 'Seasonal anime', icon: 'seasonal', href: '/anime-list?mode=SeasonalAnime' },
  { key: 'topAnime', label: 'Top anime', icon: 'fav_outline', href: '/anime-list?mode=TopAnime', more: 'topAnime' },
  { key: 'search', label: 'Search', icon: 'search', href: '/search' },
  { key: 'recom', label: 'Recommendations', icon: 'recom', href: '/recommendations' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar', href: '/calendar' },
];

const MANGA_ITEMS: NavItem[] = [
  { key: 'manga', label: 'Manga list', icon: 'list', href: '/anime-list?mode=Manga', more: 'mangaStatus' },
  { key: 'topManga', label: 'Top manga', icon: 'fav_outline', href: '/anime-list?mode=TopManga', more: 'topManga' },
];

const OTHER_ITEMS: NavItem[] = [
  { key: 'articles', label: 'Articles & News', icon: 'newspaper', href: '/articles' },
  { key: 'videos', label: 'Promotional Videos', icon: 'video', href: '/videos' },
  { key: 'forums', label: 'Forums', icon: 'forum', href: '/forums' },
  { key: 'history', label: 'History', icon: 'clock', href: '/history' },
  { key: 'clubs', label: 'Clubs', icon: 'club', href: '/clubs' },
];

export function DrawerContent(props: DrawerContentComponentProps) {
  const theme = useTheme();
  const settings = useSettings();
  const auth = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ mode?: string; status?: string; topType?: string; type?: string }>();

  const [flyout, setFlyout] = useState<{ kind: MoreKind; rect: FlyoutRect } | null>(null);
  const anchorRefs = useRef<Record<string, View | null>>({});

  const mode = params.mode ?? (pathname === '/' ? (settings.defaultMenuTab === 'manga' ? 'Manga' : 'Anime') : undefined);
  const statusFilter = params.status ?? 'all';

  function isActive(item: NavItem): boolean {
    switch (item.key) {
      case 'anime':
        return mode === 'Anime';
      case 'seasonal':
        return mode === 'SeasonalAnime';
      case 'topAnime':
        return mode === 'TopAnime';
      case 'manga':
        return mode === 'Manga';
      case 'topManga':
        return mode === 'TopManga';
      case 'search':
        return pathname === '/search';
      case 'calendar':
        return pathname === '/calendar';
      case 'recom':
        return pathname === '/recommendations';
      case 'articles':
        return pathname === '/articles' || pathname === '/article';
      case 'forums':
        return pathname === '/forums';
      case 'history':
        return pathname === '/history';
      case 'clubs':
        return pathname === '/clubs' || pathname === '/club-details';
      default:
        return false;
    }
  }

  function go(item: NavItem) {
    props.navigation.dispatch(DrawerActions.closeDrawer());
    router.push(item.href as never);
  }

  async function openMore(item: NavItem) {
    const rect = await measureAnchor({ current: anchorRefs.current[item.key] });
    if (rect) setFlyout({ kind: item.more!, rect });
  }

  function flyoutItems(): FlyoutItem[] {
    switch (flyout?.kind) {
      case 'animeStatus':
        return statusLabels(false).map((s) => ({ ...s, selected: s.key === statusFilter }));
      case 'mangaStatus':
        return statusLabels(true).map((s) => ({ ...s, selected: s.key === statusFilter }));
      case 'topAnime':
        return TOP_ANIME_TYPES.map((t) => ({ key: t, label: t, selected: (params.topType ?? 'General') === t }));
      case 'topManga':
        return TOP_MANGA_TYPES.map((t) => ({ key: t, label: t, selected: (params.type ?? 'All') === t }));
      default:
        return [];
    }
  }

  function onFlyoutSelect(key: string) {
    const kind = flyout?.kind;
    props.navigation.dispatch(DrawerActions.closeDrawer());
    if (kind === 'animeStatus') {
      router.push(`/anime-list?mode=Anime&status=${key}`);
    } else if (kind === 'mangaStatus') {
      router.push(`/anime-list?mode=Manga&status=${key}`);
    } else if (kind === 'topAnime') {
      router.push(`/anime-list?mode=TopAnime&topType=${key}&status=all`);
    } else if (kind === 'topManga') {
      router.push(`/anime-list?mode=TopManga&type=${key}&status=all`);
    }
  }

  function renderItem(item: NavItem) {
    const active = isActive(item);
    return (
      <View key={item.key} style={styles.itemRow}>
        <Ripple
          onPress={() => go(item)}
          style={[
            styles.item,
            {
              backgroundColor: active ? theme.brush.animeItemBackground : undefined,
            },
          ]}>
          <AppIcon
            name={item.icon}
            size={24}
            color={active ? theme.accentDark : theme.brush.text}
          />
          <AppText
            size={theme.fontSize.medium}
            color={active ? theme.accentColor : theme.brush.text}
            style={styles.itemLabel}
            numberOfLines={1}>
            {item.label}
          </AppText>
        </Ripple>
        {item.more ? (
          <View
            ref={(node) => {
              anchorRefs.current[item.key] = node;
            }}
            collapsable={false}
            style={styles.anchor}>
            <Ripple borderless onPress={() => openMore(item)} style={styles.moreBtn}>
              <AppIcon name="more_vertical" size={24} color={theme.brush.text} />
            </Ripple>
          </View>
        ) : null}
      </View>
    );
  }

  function renderSubheader(label: string) {
    return (
      <View style={[styles.subheader, { borderBottomColor: theme.brush.animeItemBackground }]}>
        <AppText size={theme.fontSize.normal} color={theme.brush.text} style={{ opacity: 0.6 }}>
          {label}
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.hamburgerBackground }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
        {ANIME_ITEMS.map(renderItem)}
        {settings.hideMangaSection ? null : (
          <>
            {renderSubheader('Manga')}
            {MANGA_ITEMS.map(renderItem)}
          </>
        )}
        {renderSubheader('Other')}
        {OTHER_ITEMS.map(renderItem)}
      </ScrollView>

      {/* Sticky footer — HamburgerProfileItem.xml */}
      <View style={[styles.footer, { backgroundColor: theme.brush.animeItemBackground }]}>
        <Ripple
          onPress={() => {
            props.navigation.dispatch(DrawerActions.closeDrawer());
            if (auth.authenticated) {
              router.push('/profile');
            } else {
              router.push('/login');
            }
          }}
          style={styles.profileRow}>
          <View style={{ flex: 1 }}>
            <AppText size={theme.fontSize.appBarTitle} weight="medium" color={theme.brush.text} numberOfLines={1}>
              {auth.authenticated ? auth.username : 'Profile'}
            </AppText>
            <AppText size={theme.fontSize.small} color={theme.brush.text} style={{ opacity: 0.6 }} numberOfLines={1}>
              {auth.authenticated ? 'View profile' : 'Sign in'}
            </AppText>
          </View>
          <Fab
            size={45}
            glyph={22}
            icon="notification"
            color={theme.accentDark}
            onPress={() => router.push('/notifications')}
            style={{ marginRight: 10 }}
          />
          <Fab
            size={45}
            glyph={22}
            icon="message"
            color={theme.accentDark}
            onPress={() => router.push('/messages')}
          />
        </Ripple>

        <Ripple
          onPress={() => {
            props.navigation.dispatch(DrawerActions.closeDrawer());
            router.push('/settings');
          }}
          style={styles.settingsRow}>
          <AppIcon name="settings" size={24} color={theme.brush.text} />
          <AppText size={theme.fontSize.medium} color={theme.brush.text} style={styles.itemLabel}>
            Settings &amp; more
          </AppText>
        </Ripple>
      </View>

      <Flyout
        visible={flyout !== null}
        anchor={flyout?.rect ?? null}
        alignEnd
        items={flyoutItems()}
        onSelect={onFlyoutSelect}
        onClose={() => setFlyout(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  item: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingRight: 8 },
  itemLabel: { flex: 1, marginLeft: 26, marginRight: 16 },
  anchor: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 50, alignItems: 'center', justifyContent: 'center' },
  moreBtn: { width: 50, height: 48, alignItems: 'center', justifyContent: 'center' },
  subheader: {
    height: 48,
    justifyContent: 'center',
    paddingLeft: 16,
    marginTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: { elevation: 8 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 160,
    paddingLeft: 8,
    paddingTop: 16,
    paddingBottom: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 65,
    paddingLeft: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
});
