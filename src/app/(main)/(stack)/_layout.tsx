import { Stack } from 'expo-router';
import React from 'react';

/**
 * Back-stack for the content area (`NavMgr` in the original): the drawer's
 * root pages plus pushed detail/search pages, all under the global app bar.
 */
export default function StackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="anime-list" />
      <Stack.Screen name="details" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="character-details" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="person-details" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="articles" />
      <Stack.Screen name="article" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="videos" />
      <Stack.Screen name="recommendations" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="forums" />
      <Stack.Screen name="clubs" />
      <Stack.Screen name="history" />
      <Stack.Screen name="club-details" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="search" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="settings-section" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
