import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AccountNotification, fetchAccountNotifications } from '@/api/account-pages';
import { useAuth } from '@/api/auth';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

export function NotificationsScreen() {
  const theme = useTheme();
  const auth = useAuth();
  const openDrawer = useOpenDrawer();
  const [notifications, setNotifications] = useState<AccountNotification[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setNotifications(await fetchAccountNotifications());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load MAL notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchAccountNotifications()
      .then((rows) => {
        if (!active) return;
        setNotifications(rows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load MAL notifications.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar
        title="Notifications"
        onMenuPress={openDrawer}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
      />
      {!auth.authenticated ? (
        <EmptyState title="Sign in to view notifications" message="Your MAL notifications require an authenticated account." style={styles.flex} />
      ) : error ? (
        <EmptyState title="Could not load notifications" message={error} style={styles.flex} />
      ) : notifications.length ? (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={theme.accentColor} />}>
          {notifications.map((item) => {
            const expanded = selected === item.id;
            return (
              <Ripple
                key={item.id}
                onPress={() => setSelected(expanded ? null : item.id)}
                style={[styles.card, { backgroundColor: theme.brush.animeItemBackground }]}>
                <RemoteImage uri={item.imageUrl} style={styles.avatar} radius={24} />
                <View style={styles.body}>
                  <View style={styles.heading}>
                    <AppText size={theme.fontSize.normal} weight="medium" numberOfLines={1} style={styles.title}>{item.title}</AppText>
                    <AppText size={theme.fontSize.tiny} color={theme.brush.settingsSubtitle}>{item.date}</AppText>
                  </View>
                  <AppText size={theme.fontSize.small} color={theme.brush.text} numberOfLines={expanded ? undefined : 2}>
                    {item.content}
                  </AppText>
                </View>
              </Ripple>
            );
          })}
        </ScrollView>
      ) : !loading ? (
        <EmptyState title="You are all caught up" message="No unread MAL notifications." style={styles.flex} />
      ) : null}
      <LoadingOverlay visible={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flexGrow: 1 },
  list: { padding: 8, gap: 6, paddingBottom: 24 },
  card: { minHeight: 72, flexDirection: 'row', alignItems: 'flex-start', padding: 10, gap: 10 },
  avatar: { width: 42, height: 42 },
  body: { flex: 1, gap: 5 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  title: { flex: 1 },
});
