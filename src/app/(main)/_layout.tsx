import { Drawer } from 'expo-router/drawer';
import { Redirect } from 'expo-router';
import React from 'react';

import { useAuth } from '@/api/auth';
import { DrawerContent } from '@/components/shell/drawer-content';
import { useTheme } from '@/theme/theme-context';

/**
 * The global hamburger drawer (`MainActivity.hamburger.cs`) wraps every
 * in-app page; unauthenticated users are bounced to the login page
 * (`PageRequiresAuth` in the original `PageIndex` table).
 */
export default function MainLayout() {
  const theme = useTheme();
  const auth = useAuth();

  if (!auth.authenticated) return <Redirect href="/login" />;

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          width: 300,
          backgroundColor: theme.brush.hamburgerBackground,
        },
        sceneStyle: {
          backgroundColor: theme.brush.deepBackground,
        },
        swipeEdgeWidth: 120,
        overlayColor: 'rgba(0,0,0,0.5)',
      }}>
      <Drawer.Screen name="(stack)" />
    </Drawer>
  );
}
