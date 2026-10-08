import {
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from "expo-router/react-navigation";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { hydrateAuth } from "@/api/auth";
import { hydrateSettings } from "@/store/settings";
import { ThemeProvider, useTheme } from "@/theme/theme-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Maps our token-based theme onto the react-navigation theme so drawers,
 * headers and ripples pick up the selected accent/light-dark mode.
 */
function useNavigationTheme() {
  const theme = useTheme();
  return useMemo(() => {
    const base = theme.mode === "dark";
    return {
      ...DefaultTheme,
      dark: base,
      colors: {
        primary: theme.accentColor,
        background: theme.brush.deepBackground,
        card: theme.brush.hamburgerInnerBackground,
        text: theme.brush.text,
        border: theme.brush.detailsGeneralBorder,
        notification: theme.semantic.notificationRed,
      },
    };
  }, [theme]);
}

function RootNavigator() {
  const navTheme = useNavigationTheme();
  const theme = useTheme();

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="(main)" />
        <Stack.Screen
          name="login"
          options={{ animation: "slide_from_bottom" }}
        />
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([hydrateSettings(), hydrateAuth()])
      .catch((error: unknown) => {
        console.error("Unable to restore app data securely.", error);
      })
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
