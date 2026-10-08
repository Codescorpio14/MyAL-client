import { useEffect, useState } from 'react';

import { loadList } from '@/api/library';
import { LibraryItem, ListKind } from '@/api/types';

/**
 * The merge the original does per row via
 * `AnimeSearchItemViewModel(..., animeListViewModel)` →
 * `TryRetrieveAuthenticatedAnimeItemSync(id, anime)`: which search hits are in
 * the user's list, so rows can show the "W 8/12" badge.
 *
 * Loads cache-first in the background and never blocks the search itself —
 * badges simply appear once the (cached) list resolves.
 */
export function useLibraryEntries(kind: ListKind): Map<number, LibraryItem> | null {
  const [entries, setEntries] = useState<Map<number, LibraryItem> | null>(null);

  useEffect(() => {
    let alive = true;
    loadList({ workMode: kind === 'anime' ? 'Anime' : 'Manga', kind })
      .then((items) => {
        if (!alive) return;
        setEntries(new Map(items.map((item) => [item.id, item])));
      })
      .catch(() => {
        // Not logged in / offline — search still works, just without badges.
      });
    return () => {
      alive = false;
    };
  }, [kind]);

  return entries;
}
