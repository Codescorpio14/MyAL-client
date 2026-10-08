import React from 'react';

import { AnimeListScreen } from '@/screens/anime-list/anime-list-screen';

/**
 * Alias route for every list mode — `mode`/`status`/`topType`/`type` params
 * mirror `AnimeListPageNavigationArgs` (Anime, Manga, Seasonal, Top…).
 */
export default function AnimeListRoute() {
  return <AnimeListScreen />;
}
