import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ClubDetails, ClubDetailItem, ClubComment, fetchClubDetails, joinClub, leaveClub, postClubComment } from '@/api/clubs';
import { useAuth } from '@/api/auth';
import { AppBar } from '@/components/shell/app-bar';
import { AppText } from '@/components/ui/app-text';
import { AccentButton } from '@/components/ui/buttons';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { TabDef, TabStrip } from '@/components/ui/tab-strip';
import { useTheme } from '@/theme/theme-context';

type ClubTab = 'general' | 'relations' | 'comments';

const TABS: TabDef[] = [
  { key: 'general', label: 'General' },
  { key: 'relations', label: 'Relations' },
  { key: 'comments', label: 'Comments' },
];

export function ClubDetailsScreen() {
  const theme = useTheme();
  const auth = useAuth();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const clubId = Array.isArray(id) ? id[0] : id;
  const fallbackName = Array.isArray(name) ? name[0] : name;
  const [details, setDetails] = useState<ClubDetails | null>(null);
  const [tab, setTab] = useState<ClubTab>('general');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      if (!clubId) throw new Error('This club link is missing its MAL id.');
      setDetails(await fetchClubDetails(clubId, force));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this club.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clubId]);

  useEffect(() => {
    let active = true;
    const request = clubId
      ? fetchClubDetails(clubId)
      : Promise.reject(new Error('This club link is missing its MAL id.'));
    request
      .then((result) => {
        if (!active) return;
        setDetails(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load this club.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clubId]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  const runMembershipAction = useCallback(async () => {
    if (!details) return;
    if (!auth.authenticated) {
      router.push('/login');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (details.isMember) await leaveClub(details.id);
      else await joinClub(details.id, details.canRequest);
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update club membership.');
    } finally {
      setSaving(false);
    }
  }, [auth.authenticated, details, load]);

  const submitComment = useCallback(async () => {
    if (!details) return;
    setSaving(true);
    setError(null);
    try {
      await postClubComment(details.id, comment);
      setComment('');
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to post your comment.');
    } finally {
      setSaving(false);
    }
  }, [comment, details, load]);

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar
        title={details?.name ?? fallbackName ?? 'Club'}
        onMenuPress={() => router.back()}
        onRefresh={refresh}
        right={details ? (
          <Ripple disabled={saving} onPress={() => void runMembershipAction()} style={styles.memberAction}>
            <AppText size={theme.fontSize.small} color="#fff">
              {!auth.authenticated
                ? 'Sign in'
                : details.isMember
                  ? 'Leave'
                  : details.canRequest || (!details.canJoin && !details.isPublic)
                    ? 'Request'
                    : 'Join'}
            </AppText>
          </Ripple>
        ) : null}
      />
      {details ? (
        <TabStrip
          tabs={TABS}
          activeKey={tab}
          onChange={(key) => setTab(key as ClubTab)}
          height={theme.dimens.tabStripHeight}
        />
      ) : null}
      {error && !details ? (
        <EmptyState icon="club" title="Could not load club" message={error} style={styles.flex} />
      ) : details ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accentColor} />}>
          {error ? (
            <AppText color={theme.semantic.notificationRed} style={styles.error}>{error}</AppText>
          ) : null}
          {tab === 'general' ? (
            <>
              <View style={[styles.hero, { backgroundColor: theme.brush.animeItemBackground }]}>
                <RemoteImage uri={details.imageUrl} style={styles.cover} />
                <View style={styles.heroBody}>
                  <AppText size={theme.fontSize.big} weight="medium">{details.name}</AppText>
                  <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>
                    {details.isPublic ? 'Public club' : 'Private club'}
                    {details.isMember ? ' · Member' : ''}
                  </AppText>
                </View>
              </View>
              {details.description ? <CardSection title="About">{details.description}</CardSection> : null}
              <ItemSection title="Club information" items={details.generalInfo} />
              <ItemSection title="Officers" items={details.officers} />
              <ItemSection title="Members" items={details.members} />
            </>
          ) : tab === 'relations' ? (
            <>
              <ItemSection title="Anime" items={details.animeRelations} />
              <ItemSection title="Manga" items={details.mangaRelations} />
              <ItemSection title="Characters" items={details.characterRelations} />
              {!details.animeRelations.length && !details.mangaRelations.length && !details.characterRelations.length ? (
                <AppText color={theme.brush.settingsSubtitle} style={styles.noItems}>No related anime, manga, or characters.</AppText>
              ) : null}
            </>
          ) : (
            <>
              <View style={[styles.commentComposer, { backgroundColor: theme.brush.animeItemBackground }]}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder={auth.authenticated ? 'Write a club comment…' : 'Sign in to comment'}
                  placeholderTextColor={theme.brush.settingsSubtitle}
                  editable={auth.authenticated && !saving}
                  multiline
                  style={[styles.commentInput, { color: theme.brush.text, borderColor: theme.brush.settingsSubtitle }]}
                />
                <AccentButton
                  label={saving ? 'Sending…' : 'Post comment'}
                  onPress={() => void submitComment()}
                  disabled={!auth.authenticated || saving || !comment.trim()}
                  style={styles.commentButton}
                />
              </View>
              {details.comments.length ? details.comments.map((item) => <CommentCard key={item.id} comment={item} />) : (
                <AppText color={theme.brush.settingsSubtitle} style={styles.noItems}>No recent comments found.</AppText>
              )}
            </>
          )}
        </ScrollView>
      ) : null}
      <LoadingOverlay visible={loading || (saving && !details)} />
    </View>
  );
}

function CardSection({ title, children }: { title: string; children: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.brush.animeItemBackground }]}>
      <AppText size={theme.fontSize.medium} weight="medium" color={theme.accentColor} style={styles.sectionTitle}>{title}</AppText>
      <AppText size={theme.fontSize.normal} color={theme.brush.text}>{children}</AppText>
    </View>
  );
}

function ItemSection({ title, items }: { title: string; items: ClubDetailItem[] }) {
  const theme = useTheme();
  if (!items.length) return null;
  return (
    <View style={[styles.section, { backgroundColor: theme.brush.animeItemBackground }]}>
      <AppText size={theme.fontSize.medium} weight="medium" color={theme.accentColor} style={styles.sectionTitle}>{title}</AppText>
      {items.map((item, index) => (
        <View key={`${item.label}-${item.value}-${index}`} style={styles.itemRow}>
          {item.label ? <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>{item.label}</AppText> : null}
          <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.itemValue}>{item.value}</AppText>
        </View>
      ))}
    </View>
  );
}

function CommentCard({ comment }: { comment: ClubComment }) {
  const theme = useTheme();
  return (
    <View style={[styles.commentCard, { backgroundColor: theme.brush.animeItemBackground }]}>
      <RemoteImage uri={comment.avatarUrl} style={styles.avatar} radius={25} />
      <View style={styles.commentBody}>
        <AppText size={theme.fontSize.small} weight="medium">{comment.username}</AppText>
        {comment.date ? <AppText size={theme.fontSize.tiny} color={theme.brush.settingsSubtitle}>{comment.date}</AppText> : null}
        <AppText size={theme.fontSize.normal} style={styles.commentText}>{comment.content}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flexGrow: 1 },
  memberAction: { minWidth: 58, height: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  content: { padding: 10, paddingBottom: 28, gap: 9 },
  hero: { flexDirection: 'row', minHeight: 100, alignItems: 'center', padding: 12, gap: 12 },
  cover: { width: 76, height: 76 },
  heroBody: { flex: 1, gap: 6 },
  section: { padding: 12, borderRadius: 3 },
  sectionTitle: { marginBottom: 8 },
  itemRow: { paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.25)' },
  itemValue: { marginTop: 2 },
  noItems: { padding: 18, textAlign: 'center' },
  error: { padding: 8 },
  commentComposer: { padding: 10, gap: 8 },
  commentInput: { minHeight: 80, maxHeight: 180, borderWidth: StyleSheet.hairlineWidth, borderRadius: 3, padding: 10, textAlignVertical: 'top' },
  commentButton: { alignSelf: 'flex-end', paddingHorizontal: 14 },
  commentCard: { flexDirection: 'row', padding: 10, gap: 9 },
  avatar: { width: 42, height: 42 },
  commentBody: { flex: 1, gap: 3 },
  commentText: { marginTop: 6 },
});
