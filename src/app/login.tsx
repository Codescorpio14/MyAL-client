import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  StyleSheet,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { WebViewMessageEvent } from "react-native-webview";

import {
  MAL_AUTHORIZE_URL,
  completeSignIn,
  randomPkceChallenge,
  signOut,
  useAuth,
} from "@/api/auth";
import { AppText } from "@/components/ui/app-text";
import { AccentButton, Fab } from "@/components/ui/buttons";
import { Ripple } from "@/components/ui/ripple";
import { useTheme } from "@/theme/theme-context";

const CHROME_UA =
  "Mozilla/5.0 (Linux; Android 7.0; SM-G930V Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.125 Mobile Safari/537.36";

/**
 * MAL's OAuth authorize page handles both website sign-in and the app-access
 * consent step, then returns an authorization code to the WebView.
 */
export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();

  const verifier = useMemo(() => randomPkceChallenge(), []);
  const authorizeUrl = useMemo(() => MAL_AUTHORIZE_URL(verifier), [verifier]);

  const [webVisible, setWebVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webRef = useRef<WebView>(null);
  const cookiesRef = useRef("");
  const startRef = useRef(false);
  const tokenRef = useRef(false);

  function isOAuthCallback(url: string): boolean {
    try {
      return new URL(url).pathname.endsWith("/maloauth");
    } catch {
      return false;
    }
  }

  async function handleToken(url: string) {
    if (tokenRef.current) return;
    let callback: URL;
    try {
      callback = new URL(url);
    } catch {
      failSignin("MAL returned an invalid authorization response.");
      return;
    }
    tokenRef.current = true;
    setBusy(true);
    const authorizationError = callback.searchParams.get("error");
    if (authorizationError) {
      failSignin(
        authorizationError === "access_denied"
          ? "You cancelled MAL authorization."
          : `MAL authorization failed: ${authorizationError}`,
      );
      return;
    }
    if (callback.searchParams.get("state") !== "signin") {
      failSignin("MAL returned an unexpected authorization state.");
      return;
    }
    const code = callback.searchParams.get("code");
    if (!code) {
      failSignin("Malformed authorization response.");
      return;
    }
    const result = await completeSignIn(cookiesRef.current, code, verifier);
    if (result.ok) {
      setBusy(false);
      setWebVisible(false);
      router.replace("/");
      return;
    }
    failSignin(result.reason ?? "Sign in failed.");
  }

  function failSignin(message: string) {
    startRef.current = false;
    tokenRef.current = false;
    webRef.current?.stopLoading();
    setBusy(false);
    setWebVisible(false);
    setError(message);
  }

  function onStartSignIn() {
    if (startRef.current) return;
    startRef.current = true;
    setError(null);
    setBusy(false);
    cookiesRef.current = "";
    tokenRef.current = false;
    setWebVisible(true);
  }

  const cancelSignIn = useCallback(() => {
    webRef.current?.stopLoading();
    startRef.current = false;
    tokenRef.current = false;
    setBusy(false);
    setWebVisible(false);
  }, []);

  const handleBack = useCallback(() => {
    if (webVisible) {
      cancelSignIn();
    } else if (router.canGoBack()) {
      router.back();
    }
  }, [cancelSignIn, webVisible]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (webVisible) {
          cancelSignIn();
          return true;
        }
        return !router.canGoBack();
      },
    );
    return () => subscription.remove();
  }, [cancelSignIn, webVisible]);

  function onMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        value?: string;
      };
      if (msg.type === "cookies" && msg.value) cookiesRef.current = msg.value;
    } catch {
      /* not our message */
    }
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.brush.deepBackground, paddingTop: insets.top },
      ]}
    >
      <Image
        source={require("../../assets/login/login_bg.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {!webVisible ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: 96 + insets.bottom },
          ]}
        >
          <View style={[styles.card, { borderLeftColor: theme.accentColor }]}>
            <View
              style={[styles.logoBox, { backgroundColor: theme.brush.loading }]}
            >
              <Image
                source={require("../../assets/login/wide_logo.png")}
                style={{
                  width: "100%",
                  height: 100,
                  tintColor: theme.accentDark,
                }}
                resizeMode="contain"
              />
            </View>

            <View
              style={[
                styles.cardBody,
                { backgroundColor: theme.brush.loading },
              ]}
            >
              <AccentButton
                label="Sign In"
                onPress={onStartSignIn}
                style={{ marginTop: 10 }}
              />

              {error ? (
                <AppText
                  size={theme.fontSize.small}
                  color={theme.semantic.notificationRed}
                  style={{ textAlign: "center", marginTop: 6 }}
                >
                  {error}
                </AppText>
              ) : null}

              <AppText
                size={theme.fontSize.normal}
                color="#fff"
                style={{ textAlign: "center", marginTop: 5 }}
              >
                Please remember to leave {"'Stay logged in'"} checked.
              </AppText>
            </View>
          </View>
        </ScrollView>
      ) : null}

      {/* Bottom action row — Register / Log out / Problems (LogInPage.xml) */}
      <View
        pointerEvents={webVisible ? "none" : "auto"}
        style={[styles.bottomRow, { bottom: 16 + insets.bottom }]}
      >
        <Ripple
          onPress={() =>
            void Linking.openURL("https://myanimelist.net/register.php")
          }
          style={styles.bottomSide}
        >
          <AppText size={theme.fontSize.semiNormal} color={theme.accentColor}>
            Register!
          </AppText>
        </Ripple>

        {auth.authenticated ? (
          <Ripple
            onPress={() => {
              void signOut();
            }}
            style={[
              styles.logoutBtn,
              {
                backgroundColor: theme.brush.deepBackground,
                borderColor: theme.accentColor,
              },
            ]}
          >
            <AppText size={theme.fontSize.normal} color="#fff">
              Log out
            </AppText>
          </Ripple>
        ) : null}

        <Ripple
          onPress={() => void Linking.openURL("https://myanimelist.net/")}
          style={[styles.bottomSide, { alignItems: "flex-end" }]}
        >
          <AppText
            size={theme.fontSize.semiNormal}
            color={theme.accentColor}
            style={{ textAlign: "right" }}
          >
            {"Problems?\nTwitter or Fb?"}
          </AppText>
        </Ripple>
      </View>

      {webVisible ? (
        <WebView
          ref={webRef}
          style={StyleSheet.absoluteFill}
          source={{ uri: authorizeUrl }}
          userAgent={CHROME_UA}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          onMessage={onMessage}
          onLoadEnd={(event) => {
            const url = event.nativeEvent.url;
            try {
              const host = new URL(url).hostname;
              if (host === "myanimelist.net" || host.endsWith(".myanimelist.net")) {
                webRef.current?.injectJavaScript(
                  "window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cookies', value: document.cookie })); true;",
                );
              }
            } catch {
              // Ignore non-URL load metadata from the native WebView.
            }
          }}
          onShouldStartLoadWithRequest={(request) => {
            if (isOAuthCallback(request.url)) {
              void handleToken(request.url);
              return false;
            }
            return true;
          }}
          onNavigationStateChange={(nav) => {
            if (isOAuthCallback(nav.url)) {
              void handleToken(nav.url);
            }
          }}
          onError={(event) => failSignin(event.nativeEvent.description)}
        />
      ) : null}

      {busy && webVisible ? (
        <View
          pointerEvents="none"
          style={[
            styles.processing,
            {
              top: 12,
              backgroundColor: theme.brush.loading,
            },
          ]}
        >
          <ActivityIndicator size="small" color={theme.accentColor} />
          <AppText
            size={theme.fontSize.small}
            color={theme.brush.text}
            style={{ marginLeft: 8 }}
          >
            Connecting your MAL account…
          </AppText>
        </View>
      ) : null}

      <Fab
        icon="close"
        onPress={handleBack}
        style={{ position: "absolute", right: 16, top: 16 + insets.top }}
        size={45}
        color={theme.accentDark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  processing: {
    position: "absolute",
    left: 16,
    right: 68,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 4,
  },
  content: { flex: 1 },
  contentContainer: { flexGrow: 1, justifyContent: "center" },
  card: {
    width: 300,
    alignSelf: "center",
    borderLeftWidth: 2,
    paddingLeft: 2,
  },
  logoBox: { elevation: 5, height: 100, justifyContent: "center" },
  cardBody: { padding: 16, alignItems: "center" },
  logoutBtn: {
    width: 70,
    height: 30,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  bottomSide: { minHeight: 30, justifyContent: "center", paddingHorizontal: 4 },
});
