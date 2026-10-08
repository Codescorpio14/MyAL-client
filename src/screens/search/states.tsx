import React, { type JSX } from 'react';

import { EmptyState } from '@/components/ui/overlays';

/**
 * `AnimeSearchPageFirstSearchSection` / `AnimeSearchPageEmptyNotice` — the two
 * empty states shared by every search tab:
 *   - no query yet: `icon_search_away` (100dp) + "Search away!"
 *   - no hits: "We have come up empty..." (`?BrushNoSearchResults`).
 */
export function FirstSearchState(): JSX.Element {
  return <EmptyState icon="search_away" title="Search away!" style={{ flex: 1 }} />;
}

export function NoResultsState(): JSX.Element {
  return <EmptyState title="We have come up empty..." style={{ flex: 1 }} />;
}
