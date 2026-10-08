import React, { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';

import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

const MAL_HOST = /(^|\.)myanimelist\.net$/i;

export function MalWebView({
  title,
  initialUrl,
  showAppBar = true,
}: {
  title: string;
  initialUrl: string;
  showAppBar?: boolean;
}) {
  const theme = useTheme();
  const openDrawer = useOpenDrawer();
  const webView = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function allowNavigation(request: WebViewNavigation): boolean {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return false;
    }
    if (url.protocol !== 'https:') return false;
    if (MAL_HOST.test(url.hostname)) return true;
    void Linking.openURL(url.toString()).catch(() => setError('Unable to open the external link.'));
    return false;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      {showAppBar ? (
        <AppBar
          title={title}
          onMenuPress={openDrawer}
          right={
            <Ripple
              onPress={canGoBack ? () => webView.current?.goBack() : undefined}
              disabled={!canGoBack}
              style={styles.backButton}>
              <AppText color="#fff" style={{ opacity: canGoBack ? 1 : 0.45 }}>Back</AppText>
            </Ripple>
          }
        />
      ) : null}
      {error ? (
        <View style={[styles.error, { backgroundColor: theme.brush.animeItemBackground }]}>
          <AppText color={theme.brush.text}>{error}</AppText>
        </View>
      ) : null}
      <WebView
        ref={webView}
        source={{ uri: initialUrl }}
        style={styles.webview}
        onShouldStartLoadWithRequest={allowNavigation}
        onNavigationStateChange={(state) => {
          setCanGoBack(state.canGoBack);
          setError(null);
        }}
        onError={(event) => setError(event.nativeEvent.description || 'Unable to load this MAL page.')}
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode >= 400) {
            setError(`MAL returned HTTP ${event.nativeEvent.statusCode}.`);
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled={false}
        setSupportMultipleWindows={false}
        originWhitelist={['https://*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  error: { padding: 10 },
  backButton: { minWidth: 54, height: 50, alignItems: 'center', justifyContent: 'center' },
});
