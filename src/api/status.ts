import { ListKind, StatusKey } from '@/api/types';

/**
 * Exact port of `Utilities.StatusToString` / `StatusToShortString`
 * (MALClient.XShared/Utils/Utilities.cs) — the labels shown in list rows,
 * status flyouts, the app bar and the details page.
 *
 * Status ints follow `AnimeStatus`: 1 Watching/Reading, 2 Completed,
 * 3 On hold, 4 Dropped, 6 Plan to watch/read, 7 All, 8 Airing, 0 Not Set.
 */
export function statusToString(status: number, kind: ListKind = 'anime', rewatch = false): string {
  switch (status) {
    case 1:
      return kind === 'manga' ? 'Reading' : 'Watching';
    case 2:
      if (!rewatch) return 'Completed';
      return kind === 'manga' ? 'Rereading' : 'Rewatching';
    case 3:
      return 'On hold';
    case 4:
      return 'Dropped';
    case 6:
      return kind === 'manga' ? 'Plan to read' : 'Plan to watch';
    case 7:
      return 'All';
    case 8:
      return 'Airing';
    default:
      return 'Not Set';
  }
}

export function statusToShortString(status: number, kind: ListKind = 'anime', rewatch = false): string {
  switch (status) {
    case 1:
      return kind === 'manga' ? 'R' : 'W';
    case 2:
      return rewatch ? 'Re' : 'C';
    case 3:
      return 'H';
    case 4:
      return 'D';
    case 6:
      return 'P';
    case 7:
    case 8:
      return '';
    default:
      return 'N/A';
  }
}

/** StatusKey → AnimeStatus int. */
export function statusToInt(key: StatusKey | 'all' | undefined): number {
  switch (key) {
    case 'watching':
      return 1;
    case 'completed':
      return 2;
    case 'on_hold':
      return 3;
    case 'dropped':
      return 4;
    case 'plan_to_watch':
    case 'plan_to_read':
      return 6;
    case 'all':
      return 7;
    default:
      return 7;
  }
}

/** AnimeStatus int → StatusKey ('all' for 7, undefined otherwise). */
export function statusFromInt(status: number): StatusKey | 'all' | undefined {
  switch (status) {
    case 1:
      return 'watching';
    case 2:
      return 'completed';
    case 3:
      return 'on_hold';
    case 4:
      return 'dropped';
    case 6:
      return 'plan_to_watch';
    case 7:
      return 'all';
    default:
      return undefined;
  }
}

/** Status colour used by list rows / compact items (`Brush*` status attrs). */
export function statusColor(status: StatusKey | undefined, mode: 'light' | 'dark'): string | undefined {
  switch (status) {
    case 'watching':
      return '#228B22';
    case 'completed':
      return '#1E90FF';
    case 'on_hold':
      return '#FFD700';
    case 'dropped':
      return '#DC143C';
    case 'plan_to_watch':
    case 'plan_to_read':
      return mode === 'dark' ? '#B0B0B0' : '#808080';
    default:
      return undefined;
  }
}
