import React from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AccentButton } from '@/components/ui/buttons';
import { AppText } from '@/components/ui/app-text';
import { MalWebView } from '@/screens/community/mal-webview';
import { useTheme } from '@/theme/theme-context';

export function AuthenticatedMalPage({ title, url }: { title: string; url: string }) {
  const theme = useTheme();
  const auth = useAuth();
  const openDrawer = useOpenDrawer();
  if (!auth.authenticated) {
    return (
      <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
        <AppBar title={title} onMenuPress={openDrawer} />
        <View style={styles.notice}>
          <AppText size={theme.fontSize.medium}>Sign in to access your MAL {title.toLowerCase()}.</AppText>
          <AccentButton label="Sign in" onPress={() => router.push('/login')} style={styles.button} />
        </View>
      </View>
    );
  }
  return <MalWebView title={title} initialUrl={url} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  button: { paddingHorizontal: 22 },
});
