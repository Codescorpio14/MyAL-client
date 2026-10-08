import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { fetchProfileOverview, ProfileOverview } from '@/api/scrape';
import { TenraiResponse, userFavorites, userFriends } from '@/api/tenrai';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { TabDef, TabStrip } from '@/components/ui/tab-strip';
import { useTheme } from '@/theme/theme-context';

type ProfileTab = 'general' | 'favorites' | 'updates' | 'stats';
type FavoriteKind = 'anime' | 'manga' | 'character' | 'people';

interface ProfileEntry {
  id: number;
  name: string;
  image?: string;
  kind: FavoriteKind;
  username?: string;
}

interface FriendEntry {
  username: string;
  image?: string;
  lastOnline?: string;
}

const FAVORITE_KINDS: { key: FavoriteKind; label: string }[] = [
  { key: 'anime', label: 'Anime' },
  { key: 'manga', label: 'Manga' },
  { key: 'character', label: 'Characters' },
  { key: 'people', label: 'People' },
];

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'updates', label: 'Recent updates' },
  { key: 'stats', label: 'Stats' },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function imageOf(entry: Record<string, unknown>): string | undefined {
  const images = asRecord(entry.images);
  const jpg = asRecord(images?.jpg);
  const value = jpg?.image_url ?? entry.image_url ?? entry.picture;
  return typeof value === 'string' ? value : undefined;
}

function parseFavorites(response: TenraiResponse<Record<string, unknown>>): ProfileEntry[] {
  const output: ProfileEntry[] = [];
  const apiKey: Record<FavoriteKind, string> = {
    anime: 'anime',
    manga: 'manga',
    character: 'characters',
    people: 'people',
  };
  for (const { key } of FAVORITE_KINDS) {
    const rows = response.data[apiKey[key]];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const entry = asRecord(row);
      if (!entry) continue;
      const idRaw = entry.mal_id ?? entry.id;
      const id = typeof idRaw === 'number' ? idRaw : Number(idRaw);
      const nameRaw = entry.name ?? entry.title;
      if (!Number.isSafeInteger(id) || id <= 0 || typeof nameRaw !== 'string' || !nameRaw.trim()) continue;
      output.push({ id, name: nameRaw.trim(), image: imageOf(entry), kind: key });
    }
  }
  return output;
}

function parseFriends(response: TenraiResponse<Record<string, unknown>[]>): FriendEntry[] {
  if (!Array.isArray(response.data)) return [];
  return response.data.flatMap((raw) => {
    const outer = asRecord(raw);
    const user = asRecord(outer?.user) ?? outer;
    if (!user) return [];
    const username = user?.username ?? user?.name;
    if (typeof username !== 'string' || !username.trim()) return [];
    const lastOnline = outer?.last_online;
    return [{
      username: username.trim(),
      image: imageOf(user),
      lastOnline: typeof lastOnline === 'string' ? lastOnline : undefined,
    }];
  });
}

function ProfileStats({ title, values }: { title: string; values: ProfileOverview['animeStats'] }) {
  const theme = useTheme();
  const statusNames = /^(watching|completed|on hold|dropped|plan to watch|reading|plan to read)$/i;
  const statuses = values.filter((item) => statusNames.test(item.label));
  const statistics = values.filter((item) => !statusNames.test(item.label));
  const total = statuses.reduce((sum, item) => sum + (Number(item.value.replace(/,/g, '')) || 0), 0);
  const colorFor = (label: string) => {
    const value = label.toLowerCase();
    if (value === 'watching' || value === 'reading') return theme.semantic.watching;
    if (value === 'completed') return theme.semantic.completed;
    if (value === 'dropped') return theme.semantic.dropped;
    if (value === 'on hold') return theme.semantic.onHold;
    return theme.semantic.planned;
  };
  return (
    <View style={[styles.profilePanel, { backgroundColor: theme.brush.animeItemBackground }]}>
      <AppText size={theme.fontSize.medium} color={theme.accentColor} style={[styles.panelTitle, styles.centeredTitle]}>{title}</AppText>
      {statuses.length && total > 0 ? (
        <>
          <View style={styles.statusBar}>
            {statuses.map((item) => (
              <View key={item.label} style={{ flex: Number(item.value.replace(/,/g, '')) || 0, backgroundColor: colorFor(item.label) }} />
            ))}
          </View>
          <View style={styles.statusLegend}>
            {statuses.map((item) => (
              <View key={item.label} style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: colorFor(item.label) }]} />
                <AppText size={theme.fontSize.small} color={theme.brush.text} style={styles.statusLabel}>{item.label}</AppText>
                <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>{item.value}</AppText>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {statistics.length ? (
        <View style={styles.statistics}>
          {statistics.map((item) => (
            <View key={item.label} style={[styles.statLine, { borderBottomColor: theme.brush.deepBackground }]}>
              <AppText size={theme.fontSize.normal} color={theme.brush.text}>{item.label}</AppText>
              <AppText size={theme.fontSize.normal} color={theme.brush.text} weight="medium">{item.value}</AppText>
            </View>
          ))}
        </View>
      ) : !statuses.length ? (
        <AppText size={theme.fontSize.normal} color={theme.brush.settingsSubtitle}>No statistics available.</AppText>
      ) : null}
    </View>
  );
}

export function ProfileScreen() {
  const theme = useTheme();
  const openDrawer = useOpenDrawer();
  const auth = useAuth();
  const params = useLocalSearchParams<{ username?: string }>();
  const username = (typeof params.username === 'string' ? params.username : auth.username).trim();
  const [tab, setTab] = useState<ProfileTab>('general');
  const [favoriteKind, setFavoriteKind] = useState<FavoriteKind>('anime');
  const [favorites, setFavorites] = useState<ProfileEntry[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [profile, setProfile] = useState<ProfileOverview | null>(null);
  const [loadErrors, setLoadErrors] = useState<Partial<Record<'profile' | 'favorites' | 'friends' | 'updates', string>>>({});
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!username) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setLoadErrors({});
      const results = await Promise.allSettled([
        fetchProfileOverview(username),
        userFavorites(username),
        userFriends(username, 1),
      ]);
      if (!active) return;
      const errors: typeof loadErrors = {};
      const recordError = (key: keyof typeof errors, result: PromiseSettledResult<unknown>) => {
        if (result.status === 'rejected') {
          errors[key] = result.reason instanceof Error ? result.reason.message : 'Could not load this section.';
        }
      };
      if (results[0].status === 'fulfilled') setProfile(results[0].value);
      else {
        recordError('profile', results[0]);
        recordError('updates', results[0]);
      }
      if (results[1].status === 'fulfilled') setFavorites(parseFavorites(results[1].value));
      else recordError('favorites', results[1]);
      if (results[2].status === 'fulfilled') setFriends(parseFriends(results[2].value));
      else recordError('friends', results[2]);
      setLoadErrors(errors);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [username, reloadToken]);

  const visibleFavorites = useMemo(
    () => favorites.filter((entry) => entry.kind === favoriteKind),
    [favorites, favoriteKind]
  );

  const tabs: TabDef[] = PROFILE_TABS;

  const openFavorite = useCallback((entry: ProfileEntry) => {
    if (entry.kind === 'anime' || entry.kind === 'manga') {
      router.push(`/details?kind=${entry.kind}&id=${entry.id}&title=${encodeURIComponent(entry.name)}`);
    } else if (entry.kind === 'character') {
      router.push(`/character-details?id=${entry.id}&title=${encodeURIComponent(entry.name)}`);
    } else {
      router.push(`/person-details?id=${entry.id}&title=${encodeURIComponent(entry.name)}`);
    }
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar title={username || 'Profile'} onMenuPress={openDrawer} onRefresh={() => setReloadToken((token) => token + 1)} />
      {!username ? (
        <EmptyState title="Sign in to view your profile" message="Your profile favorites and friends will appear here." />
      ) : (
        <>
          <TabStrip tabs={tabs} activeKey={tab} onChange={(key) => setTab(key as ProfileTab)} height={theme.dimens.tabStripHeight} />
          {tab === 'general' ? (
            <ScrollView contentContainerStyle={styles.list}>
              {loadErrors.profile ? <EmptyState title="Profile unavailable" message={loadErrors.profile} /> : null}
              <View style={[styles.profileSummary, { backgroundColor: theme.brush.animeItemBackground }]}>
                {(profile?.imageUrl || (auth.username.toLowerCase() === username.toLowerCase() ? auth.picture : '')) ? (
                  <RemoteImage uri={profile?.imageUrl ?? auth.picture} style={styles.avatar} radius={32} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.accentDark }]}>
                    <AppText size={theme.fontSize.big} color="#fff">{username.slice(0, 1).toUpperCase()}</AppText>
                  </View>
                )}
                <View style={styles.headerText}>
                  <AppText size={theme.fontSize.big} color={theme.brush.text} numberOfLines={1}>{username}</AppText>
                  {profile?.details.slice(0, 4).map((item) => (
                    <AppText key={item.label} size={theme.fontSize.small} color={theme.brush.settingsSubtitle} numberOfLines={1}>
                      {item.label}: {item.value}
                    </AppText>
                  ))}
                </View>
              </View>
              <View style={styles.profileActions}>
                <ProfileAction label="Anime list" onPress={() => router.push('/anime-list?mode=Anime')} />
                <ProfileAction label="Manga list" onPress={() => router.push('/anime-list?mode=Manga')} />
                <ProfileAction
                  label="Share profile"
                  onPress={() => void Share.share({
                    title: `${username}'s MAL profile`,
                    message: `https://myanimelist.net/profile/${encodeURIComponent(username)}`,
                  })}
                />
              </View>
              <View style={[styles.profilePanel, { backgroundColor: theme.brush.animeItemBackground }]}>
                <AppText size={theme.fontSize.medium} color={theme.accentColor} style={styles.panelTitle}>Friends</AppText>
                {loadErrors.friends ? (
                  <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>{loadErrors.friends}</AppText>
                ) : friends.length ? (
                  <View style={styles.friendAvatars}>
                    {friends.slice(0, 24).map((friend) => (
                      <Ripple
                        key={friend.username}
                        accessibilityLabel={friend.username}
                        onPress={() => router.push(`/profile?username=${encodeURIComponent(friend.username)}`)}
                        style={styles.friendAvatarTap}>
                        <RemoteImage uri={friend.image} style={styles.friendImage} radius={24} />
                      </Ripple>
                    ))}
                  </View>
                ) : (
                  <AppText size={theme.fontSize.normal} color={theme.brush.settingsSubtitle}>No friends found.</AppText>
                )}
              </View>
              {profile ? (
                <>
                  {profile.about ? (
                    <View style={[styles.profilePanel, { backgroundColor: theme.brush.animeItemBackground }]}>
                      <AppText size={theme.fontSize.medium} color={theme.accentColor} style={styles.panelTitle}>About</AppText>
                      <AppText size={theme.fontSize.normal} color={theme.brush.text}>{profile.about}</AppText>
                    </View>
                  ) : null}
                </>
              ) : !loadErrors.profile ? <EmptyState title="No profile information found" /> : null}
            </ScrollView>
          ) : tab === 'stats' ? (
            <ScrollView contentContainerStyle={styles.list}>
              {loadErrors.profile ? <EmptyState title="Statistics unavailable" message={loadErrors.profile} /> : null}
              {profile ? (
                <>
                  <ProfileStats title="Anime statistics" values={profile.animeStats} />
                  <ProfileStats title="Manga statistics" values={profile.mangaStats} />
                </>
              ) : !loadErrors.profile ? <EmptyState title="No statistics found" /> : null}
            </ScrollView>
          ) : tab === 'updates' ? (
            <>
              {loadErrors.updates ? <EmptyState title="Updates unavailable" message={loadErrors.updates} /> : null}
              {!loadErrors.updates && !loading && (profile?.updates.length ?? 0) === 0 ? <EmptyState title="No recent updates found" /> : null}
              <FlatList
                data={profile?.updates ?? []}
                keyExtractor={(entry, index) => `${entry.kind}-${entry.id}-${index}`}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <Ripple onPress={() => router.push(`/details?kind=${item.kind}&id=${item.id}&title=${encodeURIComponent(item.title)}`)} style={[styles.favoriteRow, { backgroundColor: theme.brush.animeItemBackground }]}>
                    <RemoteImage uri={item.imageUrl} style={styles.favoriteImage} />
                    <View style={styles.updateText}>
                      <AppText size={theme.fontSize.normal} color={theme.brush.text} numberOfLines={2}>{item.title}</AppText>
                      <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>
                        {[item.progress, item.date].filter(Boolean).join(' · ') || (item.kind === 'anime' ? 'Anime' : 'Manga')}
                      </AppText>
                    </View>
                  </Ripple>
                )}
              />
            </>
          ) : tab === 'favorites' ? (
            <>
              <View style={styles.kindTabs}>
                {FAVORITE_KINDS.map((kind) => {
                  const selected = kind.key === favoriteKind;
                  return (
                    <Ripple
                      key={kind.key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      onPress={() => setFavoriteKind(kind.key)}
                      style={[styles.kindTab, { borderBottomColor: selected ? theme.accentColor : 'transparent' }]}>
                      <AppText size={theme.fontSize.small} color={selected ? theme.accentColor : theme.brush.text}>
                        {kind.label}
                      </AppText>
                    </Ripple>
                  );
                })}
              </View>
              {loadErrors.favorites ? <EmptyState title="Favorites unavailable" message={loadErrors.favorites} /> : null}
              {!loadErrors.favorites && !loading && visibleFavorites.length === 0 ? <EmptyState title="No favorites found" /> : null}
              <FlatList
                data={visibleFavorites}
                keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <Ripple onPress={() => openFavorite(item)} style={[styles.favoriteRow, { backgroundColor: theme.brush.animeItemBackground }]}>
                    <RemoteImage uri={item.image} style={styles.favoriteImage} />
                    <AppText size={theme.fontSize.normal} color={theme.brush.text} numberOfLines={2} style={styles.favoriteName}>
                      {item.name}
                    </AppText>
                  </Ripple>
                )}
              />
            </>
          ) : null}
        </>
      )}
      <LoadingOverlay visible={loading} />
    </View>
  );
}

function ProfileAction({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Ripple onPress={onPress} style={[styles.profileAction, { backgroundColor: theme.accentDark }]}>
      <AppText size={theme.fontSize.small} color="#fff" numberOfLines={1}>{label}</AppText>
    </Ripple>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  profileSummary: { minHeight: 96, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 58, height: 58 },
  avatarFallback: { borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, marginLeft: 12, gap: 3, minWidth: 0 },
  profileActions: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  profileAction: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderRadius: 3 },
  kindTabs: { flexDirection: 'row', minHeight: 42 },
  kindTab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2 },
  list: { padding: 8, paddingBottom: 24 },
  profilePanel: { padding: 12, marginBottom: 8, borderRadius: 4 },
  panelTitle: { marginBottom: 8 },
  centeredTitle: { textAlign: 'center' },
  statusBar: { height: 12, flexDirection: 'row', overflow: 'hidden', borderRadius: 6, marginBottom: 8 },
  statusLegend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6, paddingBottom: 8 },
  statusRow: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { flex: 1 },
  statistics: { marginTop: 4 },
  statLine: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  friendAvatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  friendAvatarTap: { width: 48, height: 48 },
  favoriteRow: { flexDirection: 'row', alignItems: 'center', minHeight: 72, padding: 8, marginBottom: 4 },
  favoriteImage: { width: 48, height: 60 },
  favoriteName: { flex: 1, paddingHorizontal: 10 },
  friendImage: { width: 48, height: 48 },
  updateText: { flex: 1, paddingHorizontal: 10, gap: 4 },
});
