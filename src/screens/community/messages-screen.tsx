import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AccountMessage, fetchMessages, fetchMessageThread, MessagePart, sendMessageReply } from '@/api/account-pages';
import { useAuth } from '@/api/auth';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { AccentButton } from '@/components/ui/buttons';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { TabDef, TabStrip } from '@/components/ui/tab-strip';
import { useTheme } from '@/theme/theme-context';

type Folder = 'inbox' | 'sent';
const TABS: TabDef[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'sent', label: 'Sent' },
];

export function MessagesScreen() {
  const theme = useTheme();
  const auth = useAuth();
  const openDrawer = useOpenDrawer();
  const [folder, setFolder] = useState<Folder>('inbox');
  const [messages, setMessages] = useState<AccountMessage[]>([]);
  const [selected, setSelected] = useState<AccountMessage | null>(null);
  const [parts, setParts] = useState<MessagePart[]>([]);
  const [reply, setReply] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMessages(await fetchMessages(folder));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load MAL messages.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [folder]);

  useEffect(() => {
    let active = true;
    fetchMessages(folder)
      .then((rows) => {
        if (!active) return;
        setMessages(rows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load MAL messages.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [folder]);

  const openMessage = useCallback(async (message: AccountMessage) => {
    setSelected(message);
    setParts([]);
    setLoading(true);
    setError(null);
    try {
      setParts(await fetchMessageThread(message));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this message.');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendReply = useCallback(async () => {
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      await sendMessageReply(selected, reply);
      setReply('');
      setShowReply(false);
      setParts(await fetchMessageThread(selected));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send your reply.');
    } finally {
      setSending(false);
    }
  }, [reply, selected]);

  const title = selected?.subject ?? 'Messages';

  if (!auth.authenticated) {
    return (
      <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
        <AppBar title="Messages" onMenuPress={openDrawer} />
        <EmptyState title="Sign in to view messages" message="Your MAL inbox requires an authenticated account." style={styles.flex} />
        <AccentButton label="Sign in" onPress={() => router.push('/login')} style={styles.loginButton} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar
        title={title}
        onMenuPress={selected ? () => setSelected(null) : openDrawer}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        right={selected ? (
          <Ripple onPress={() => setShowReply(true)} style={styles.headerAction}>
            <AppText color="#fff" size={theme.fontSize.small}>Reply</AppText>
          </Ripple>
        ) : null}
      />
      {!selected ? (
        <TabStrip tabs={TABS} activeKey={folder} onChange={(key) => setFolder(key as Folder)} height={theme.dimens.tabStripHeight} />
      ) : null}
      {error ? (
        <EmptyState title="Could not load messages" message={error} style={styles.flex} />
      ) : selected ? (
        <ScrollView
          contentContainerStyle={styles.thread}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void openMessage(selected)} tintColor={theme.accentColor} />}>
          {parts.map((part, index) => (
            <View key={`${part.date}-${index}`} style={[styles.messagePart, { backgroundColor: theme.brush.animeItemBackground }]}>
              <AppText size={theme.fontSize.medium} weight="medium">{part.sender}</AppText>
              <AppText size={theme.fontSize.tiny} color={theme.brush.settingsSubtitle}>{part.date}</AppText>
              <AppText size={theme.fontSize.normal} style={styles.messageContent}>{part.content}</AppText>
            </View>
          ))}
        </ScrollView>
      ) : messages.length ? (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={theme.accentColor} />}>
          {messages.map((message) => (
            <Ripple
              key={`${message.id}-${message.isSent}`}
              onPress={() => void openMessage(message)}
              style={[styles.row, { backgroundColor: theme.brush.animeItemBackground, opacity: message.isRead ? 0.85 : 1 }]}>
              <RemoteImage uri={message.avatarUrl} style={styles.avatar} radius={25} />
              <View style={styles.rowBody}>
                <View style={styles.rowHeading}>
                  <AppText size={theme.fontSize.normal} weight={message.isRead ? undefined : 'medium'} numberOfLines={1} style={styles.sender}>
                    {message.isSent ? `To: ${message.sender}` : message.sender}
                  </AppText>
                  <AppText size={theme.fontSize.tiny} color={theme.brush.settingsSubtitle}>{message.date}</AppText>
                </View>
                <AppText size={theme.fontSize.small} color={theme.brush.text} numberOfLines={1}>{message.subject}</AppText>
                <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle} numberOfLines={2}>{message.preview}</AppText>
              </View>
            </Ripple>
          ))}
        </ScrollView>
      ) : !loading ? (
        <EmptyState title={folder === 'inbox' ? 'Inbox is empty' : 'No sent messages'} style={styles.flex} />
      ) : null}
      <LoadingOverlay visible={loading} />
      <Modal visible={showReply} transparent animationType="fade" onRequestClose={() => setShowReply(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.composer, { backgroundColor: theme.brush.deepBackground }]}>
            <AppText size={theme.fontSize.big} weight="medium">Reply to {selected?.sender}</AppText>
            <TextInput
              value={reply}
              onChangeText={setReply}
              multiline
              editable={!sending}
              placeholder="Write your reply"
              placeholderTextColor={theme.brush.settingsSubtitle}
              style={[styles.input, { color: theme.brush.text, borderColor: theme.brush.settingsSubtitle }]}
            />
            {error ? <AppText size={theme.fontSize.small} color={theme.semantic.notificationRed}>{error}</AppText> : null}
            <View style={styles.actions}>
              <Ripple onPress={() => setShowReply(false)} style={styles.cancel}><AppText color={theme.brush.settingsSubtitle}>Cancel</AppText></Ripple>
              <AccentButton label={sending ? 'Sending…' : 'Send'} disabled={sending || !reply.trim()} onPress={() => void sendReply()} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flexGrow: 1 },
  loginButton: { alignSelf: 'center', marginBottom: 24, paddingHorizontal: 26 },
  headerAction: { minWidth: 58, height: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  list: { padding: 8, gap: 6, paddingBottom: 24 },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10 },
  avatar: { width: 44, height: 44 },
  rowBody: { flex: 1, gap: 4 },
  rowHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  sender: { flex: 1 },
  thread: { padding: 8, gap: 8, paddingBottom: 24 },
  messagePart: { padding: 12, gap: 5 },
  messageContent: { marginTop: 8, lineHeight: 21 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.65)' },
  composer: { padding: 16, gap: 12 },
  input: { minHeight: 150, maxHeight: 260, borderWidth: StyleSheet.hairlineWidth, padding: 10, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  cancel: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
});
