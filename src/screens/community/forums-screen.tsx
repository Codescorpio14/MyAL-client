import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useAuth } from '@/api/auth';
import {
  fetchForumBoards,
  fetchForumThread,
  fetchForumTopics,
  fetchRecentForumTopics,
  createForumTopic,
  postForumReply,
  ForumBoard,
  ForumBoardGroup,
  ForumThread,
  ForumTopicPreview,
} from '@/api/forums';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppIcon } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { AccentButton } from '@/components/ui/buttons';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { TabDef, TabStrip } from '@/components/ui/tab-strip';
import { useTheme } from '@/theme/theme-context';

type ForumMode = 'boards' | 'recent';

const TABS: TabDef[] = [
  { key: 'boards', label: 'Boards' },
  { key: 'recent', label: 'Recent' },
];

export function ForumsScreen() {
  const theme = useTheme();
  const auth = useAuth();
  const openDrawer = useOpenDrawer();
  const [mode, setMode] = useState<ForumMode>('boards');
  const [groups, setGroups] = useState<ForumBoardGroup[]>([]);
  const [recent, setRecent] = useState<ForumTopicPreview[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<ForumBoard | null>(null);
  const [boardTopics, setBoardTopics] = useState<ForumTopicPreview[]>([]);
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [pinned, setPinned] = useState<ForumBoard[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerKind, setComposerKind] = useState<'topic' | 'reply' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const [boardGroups, recentTopics] = await Promise.all([
        fetchForumBoards(force),
        fetchRecentForumTopics(force),
      ]);
      setGroups(boardGroups);
      setRecent(recentTopics);
      if (thread) {
        setThread(await fetchForumThread(thread.id, thread.title, force));
      } else if (selectedBoard) {
        const board = boardGroups.flatMap((group) => group.boards).find((item) => item.id === selectedBoard.id);
        if (board) {
          setSelectedBoard(board);
          setBoardTopics(await fetchForumTopics(board, force));
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load MAL forums.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBoard, thread]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchForumBoards(), fetchRecentForumTopics()])
      .then(([boardGroups, recentTopics]) => {
        if (!active) return;
        setGroups(boardGroups);
        setRecent(recentTopics);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load MAL forums.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  const filteredGroups = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return groups;
    return groups
      .map((group) => ({
        ...group,
        boards: group.boards.filter(
          (board) =>
            board.title.toLowerCase().includes(query) ||
            board.description.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.boards.length > 0);
  }, [groups, searchText]);

  const openBoard = useCallback(async (board: ForumBoard) => {
    setThread(null);
    setSelectedBoard(board);
    setBoardTopics([]);
    setLoading(true);
    setError(null);
    try {
      setBoardTopics(await fetchForumTopics(board));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this forum board.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openThread = useCallback(async (topic: ForumTopicPreview) => {
    setThread({ id: topic.id, title: topic.title, messages: [] });
    setLoading(true);
    setError(null);
    try {
      setThread(await fetchForumThread(topic.id, topic.title));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this forum topic.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openComposer = useCallback((kind: 'topic' | 'reply') => {
    setDraftTitle('');
    setDraftMessage('');
    setComposerError(null);
    setComposerKind(kind);
  }, []);

  const submitComposer = useCallback(async () => {
    if (!auth.authenticated) {
      setComposerError('Sign in to MAL to post in the forums.');
      return;
    }
    setPosting(true);
    setComposerError(null);
    try {
      if (composerKind === 'reply' && thread) {
        await postForumReply(thread.id, draftMessage);
        setComposerKind(null);
        setThread(await fetchForumThread(thread.id, thread.title, true));
      } else if (composerKind === 'topic' && selectedBoard) {
        const topicId = await createForumTopic(selectedBoard.id, draftTitle, draftMessage);
        setComposerKind(null);
        const topics = await fetchForumTopics(selectedBoard, true);
        setBoardTopics(topics);
        if (topicId) {
          await openThread({
            id: topicId,
            title: draftTitle.trim(),
            username: auth.username,
            date: 'Just now',
            boardName: selectedBoard.title,
          });
        }
      }
    } catch (cause) {
      setComposerError(cause instanceof Error ? cause.message : 'Unable to submit your forum post.');
    } finally {
      setPosting(false);
    }
  }, [auth.authenticated, auth.username, composerKind, draftMessage, draftTitle, openThread, selectedBoard, thread]);

  const navigateBack = useCallback(() => {
    if (thread) {
      setThread(null);
      return;
    }
    if (selectedBoard) {
      setSelectedBoard(null);
      return;
    }
    openDrawer();
  }, [openDrawer, selectedBoard, thread]);

  const togglePin = useCallback((board: ForumBoard) => {
    setPinned((current) =>
      current.some((item) => item.id === board.id)
        ? current.filter((item) => item.id !== board.id)
        : [...current, board]
    );
  }, []);

  const isPinned = selectedBoard ? pinned.some((board) => board.id === selectedBoard.id) : false;

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar
        title={thread?.title ?? selectedBoard?.title ?? 'Forums'}
        onMenuPress={navigateBack}
        onRefresh={refresh}
        search={{
          hint: 'Filter forum boards',
          value: searchText,
          onChange: setSearchText,
          onClose: () => setSearchText(''),
        }}
        right={
          thread ? (
            <Ripple onPress={() => openComposer('reply')} style={styles.headerAction}>
              <AppIcon name="send" size={20} color="#fff" />
            </Ripple>
          ) : selectedBoard ? (
            <View style={styles.headerActions}>
              <Ripple onPress={() => openComposer('topic')} style={styles.headerAction}>
                <AppIcon name="add" size={22} color="#fff" />
              </Ripple>
              <Ripple onPress={() => togglePin(selectedBoard)} style={styles.headerAction}>
                <AppIcon name="fav_outline" size={22} color={isPinned ? theme.accentColor : '#fff'} />
              </Ripple>
            </View>
          ) : null
        }
      />
      {!selectedBoard && !thread ? (
        <TabStrip
          tabs={TABS}
          activeKey={mode}
          onChange={(key) => setMode(key as ForumMode)}
          height={theme.dimens.tabStripHeightTall}
        />
      ) : null}
      {!selectedBoard && !thread && mode === 'boards' ? (
        <View style={[styles.pinnedBar, { backgroundColor: theme.brush.pivotHeaderBackground }]}>
          <AppIcon name="list" size={22} color={theme.brush.text} />
          {pinned.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinnedItems}>
              {pinned.map((board) => (
                <Ripple
                  key={board.id}
                  onPress={() => void openBoard(board)}
                  style={[styles.pinnedChip, { borderColor: theme.accentColor }]}>
                  <AppText size={theme.fontSize.small} numberOfLines={1}>{board.title}</AppText>
                </Ripple>
              ))}
            </ScrollView>
          ) : (
            <AppText size={theme.fontSize.normal} color={theme.brush.settingsSubtitle} style={styles.pinnedHint}>
              Pinned boards go here...
            </AppText>
          )}
          <Ripple onPress={() => setMode('recent')} style={styles.moreButton}>
            <AppIcon name="more_vertical" size={22} color={theme.brush.text} />
          </Ripple>
        </View>
      ) : null}

      {error && !loading ? (
        <EmptyState icon="forum" title="Could not load forums" message={error} style={styles.flex} />
      ) : thread ? (
        thread.messages.length ? (
          <ScrollView
            contentContainerStyle={styles.threadList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accentColor} />}>
            {thread.messages.map((message, index) => (
              <ForumMessageCard key={message.id} message={message} postNumber={index + 1} />
            ))}
          </ScrollView>
        ) : !loading ? (
          <EmptyState icon="forum" title="No posts found" style={styles.flex} />
        ) : null
      ) : selectedBoard ? (
        boardTopics.length ? (
          <ScrollView
            contentContainerStyle={styles.topicList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accentColor} />}>
            {boardTopics.map((topic) => (
              <TopicRow key={topic.id} topic={topic} onPress={() => void openThread(topic)} />
            ))}
          </ScrollView>
        ) : !loading ? (
          <EmptyState icon="forum" title="No topics found" message="This board has no visible topics right now." style={styles.flex} />
        ) : null
      ) : mode === 'recent' ? (
        recent.length ? (
          <ScrollView
            contentContainerStyle={styles.topicList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accentColor} />}>
            {recent.map((topic) => (
              <TopicRow key={topic.id} topic={topic} onPress={() => void openThread(topic)} />
            ))}
          </ScrollView>
        ) : !loading ? (
          <EmptyState icon="forum" title="No recent topics found" style={styles.flex} />
        ) : null
      ) : groups.length ? (
        <ScrollView
          contentContainerStyle={styles.boardList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accentColor} />}>
          {filteredGroups.map((group) => (
            <View key={group.title}>
              <AppText size={theme.fontSize.big} color={theme.accentColor} style={styles.groupTitle}>
                {group.title}
              </AppText>
              {group.boards.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  onPress={() => void openBoard(board)}
                  onTopicPress={(topic) => void openThread(topic)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : !loading ? (
        <EmptyState icon="forum" title="No forum boards found" style={styles.flex} />
      ) : null}
      <LoadingOverlay visible={loading} />
      <Modal
        visible={composerKind !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setComposerKind(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.composer, { backgroundColor: theme.brush.deepBackground }]}>
            <AppText size={theme.fontSize.big} weight="medium">
              {composerKind === 'topic' ? 'New forum topic' : 'Reply to topic'}
            </AppText>
            {composerKind === 'topic' ? (
              <TextInput
                value={draftTitle}
                onChangeText={setDraftTitle}
                placeholder="Topic title"
                placeholderTextColor={theme.brush.settingsSubtitle}
                editable={!posting}
                style={[styles.composerTitle, { color: theme.brush.text, borderColor: theme.brush.settingsSubtitle }]}
              />
            ) : null}
            <TextInput
              value={draftMessage}
              onChangeText={setDraftMessage}
              placeholder="Write your message"
              placeholderTextColor={theme.brush.settingsSubtitle}
              editable={!posting}
              multiline
              style={[styles.composerMessage, { color: theme.brush.text, borderColor: theme.brush.settingsSubtitle }]}
            />
            {!auth.authenticated ? (
              <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>
                Sign in to MAL before posting.
              </AppText>
            ) : null}
            {composerError ? <AppText size={theme.fontSize.small} color={theme.semantic.notificationRed}>{composerError}</AppText> : null}
            <View style={styles.composerActions}>
              <Ripple disabled={posting} onPress={() => setComposerKind(null)} style={styles.cancelAction}>
                <AppText color={theme.brush.settingsSubtitle}>Cancel</AppText>
              </Ripple>
              <AccentButton
                label={posting ? 'Posting…' : composerKind === 'topic' ? 'Create topic' : 'Send reply'}
                onPress={() => void submitComposer()}
                disabled={posting || !draftMessage.trim() || (composerKind === 'topic' && !draftTitle.trim())}
                style={styles.submitAction}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BoardCard({
  board,
  onPress,
  onTopicPress,
}: {
  board: ForumBoard;
  onPress: () => void;
  onTopicPress: (topic: ForumTopicPreview) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.boardCard, { backgroundColor: theme.brush.animeItemBackground }]}>
      <Ripple onPress={onPress} style={styles.boardHeading}>
        <AppText size={theme.fontSize.big} weight="medium" numberOfLines={1}>{board.title}</AppText>
        <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle} style={styles.boardDescription}>
          {board.description}
        </AppText>
      </Ripple>
      {board.previews.length ? (
        <View style={styles.previewRow}>
          {board.previews.slice(0, 2).map((topic) => (
            <Ripple key={topic.id} onPress={() => onTopicPress(topic)} style={styles.preview}>
              <RemoteImage uri={topic.avatarUrl} style={styles.avatar} radius={25} />
              <View style={styles.previewBody}>
                <AppText size={theme.fontSize.small} weight="medium" numberOfLines={2}>{topic.title}</AppText>
                <AppText size={theme.fontSize.tiny} color={theme.brush.settingsSubtitle} numberOfLines={1}>
                  {topic.date}
                </AppText>
              </View>
            </Ripple>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TopicRow({ topic, onPress }: { topic: ForumTopicPreview; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Ripple onPress={onPress} style={[styles.topicRow, { backgroundColor: theme.brush.animeItemBackground }]}>
      <RemoteImage uri={topic.avatarUrl} style={styles.avatar} radius={25} />
      <View style={styles.previewBody}>
        <AppText size={theme.fontSize.medium} weight="medium" numberOfLines={2}>{topic.title}</AppText>
        <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle} numberOfLines={1}>
          {[topic.boardName, topic.username, topic.date].filter(Boolean).join(' · ')}
        </AppText>
      </View>
      <AppIcon name="chevron_right" size={20} color={theme.brush.settingsSubtitle} />
    </Ripple>
  );
}

function ForumMessageCard({
  message,
  postNumber,
}: {
  message: ForumThread['messages'][number];
  postNumber: number;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.messageCard, { backgroundColor: theme.brush.animeItemBackground }]}>
      <View style={[styles.messageHeader, { borderBottomColor: theme.brush.deepBackground }]}>
        <RemoteImage uri={message.avatarUrl} style={styles.messageAvatar} radius={28} />
        <View style={styles.messageUser}>
          <AppText size={theme.fontSize.medium} weight="medium">{message.username}</AppText>
          <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>{message.date}</AppText>
        </View>
        <AppText size={theme.fontSize.small} color={theme.accentColor}>#{postNumber}</AppText>
      </View>
      <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.messageBody}>
        {message.body}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flexGrow: 1 },
  headerActions: { flexDirection: 'row' },
  headerAction: { width: 42, height: 50, alignItems: 'center', justifyContent: 'center' },
  pinnedBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12 },
  pinnedItems: { alignItems: 'center', gap: 8 },
  pinnedHint: { flex: 1, textAlign: 'center' },
  pinnedChip: { maxWidth: 175, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 3 },
  moreButton: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  boardList: { paddingHorizontal: 10, paddingBottom: 24 },
  groupTitle: { textAlign: 'center', paddingVertical: 12, marginTop: 4 },
  boardCard: { marginBottom: 10, padding: 10, borderRadius: 2 },
  boardHeading: { alignItems: 'center', paddingBottom: 4 },
  boardDescription: { textAlign: 'center', marginTop: 4, marginBottom: 6 },
  previewRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.16)', paddingTop: 8, gap: 10 },
  preview: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6, minWidth: 0 },
  avatar: { width: 36, height: 36, backgroundColor: 'rgba(0,0,0,0.15)' },
  previewBody: { flex: 1, gap: 4 },
  topicList: { padding: 8, paddingBottom: 24, gap: 6 },
  topicRow: { minHeight: 70, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  threadList: { padding: 8, paddingBottom: 24, gap: 8 },
  messageCard: { padding: 10 },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  messageAvatar: { width: 44, height: 44 },
  messageUser: { flex: 1, gap: 3 },
  messageBody: { paddingTop: 10, lineHeight: 21 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 18 },
  composer: { padding: 16, borderRadius: 4, gap: 12 },
  composerTitle: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10 },
  composerMessage: { minHeight: 140, maxHeight: 260, borderWidth: StyleSheet.hairlineWidth, padding: 10, textAlignVertical: 'top' },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelAction: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 10 },
  submitAction: { paddingHorizontal: 12 },
});
