import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { AccentName } from '@/theme/tokens';

/**
 * Mirrors `MALClient.XShared/Utils/Settings.cs` — persisted user preferences.
 * Keys are stored flat in AsyncStorage under `settings:{key}`.
 */
export interface AppSettings {
  /** `Settings.AccentColour` — one of 8 accents, default orange. */
  accent: AccentName;
  /** Light/dark theme (the original switches via `Activity.SetTheme`). */
  themeMode: 'light' | 'dark';
  /** `Settings.DefaultMenuTab` — which list opens first. */
  defaultMenuTab: 'anime' | 'manga';
  /** `Settings.HamburgerHideMangaSection` */
  hideMangaSection: boolean;
  /** `Settings.AnimeListSortDirectionAscending` */
  listSortAscending: boolean;
  /** `Settings.HamburgerPinTopAnime` etc. — drawer cosmetics are default for now. */
  /** `Settings.ListItemsAnimationEnable` */
  listAnimationsEnabled: boolean;
  /** `Settings.OldTabAnimations` */
  pullToRefreshEnabled: boolean;
  /** `Settings.PreferEnglishTitles` */
  preferEnglishTitles: boolean;
  /** `Settings.ShowPriorities` */
  showPriorities: boolean;
  /** `Settings.EnableCache` */
  cacheEnabled: boolean;
  calendarIncludeWatching: boolean;
  calendarIncludePlanned: boolean;
  calendarMondayFirst: boolean;
  calendarStartOnToday: boolean;
  calendarRemoveEmptyDays: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  accent: 'orange',
  themeMode: 'light',
  defaultMenuTab: 'anime',
  hideMangaSection: false,
  listSortAscending: false,
  listAnimationsEnabled: true,
  pullToRefreshEnabled: true,
  preferEnglishTitles: false,
  showPriorities: true,
  cacheEnabled: true,
  calendarIncludeWatching: true,
  calendarIncludePlanned: true,
  calendarMondayFirst: false,
  calendarStartOnToday: false,
  calendarRemoveEmptyDays: true,
};

const STORAGE_PREFIX = 'settings:';

let state: AppSettings = { ...DEFAULT_SETTINGS };
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Call once at app start; resolves when persisted settings have been read. */
export async function hydrateSettings(): Promise<void> {
  if (hydrated) return;
  try {
    const entries = await AsyncStorage.multiGet(
      Object.keys(DEFAULT_SETTINGS).map((k) => STORAGE_PREFIX + k)
    );
    const next: AppSettings = { ...DEFAULT_SETTINGS };
    for (const [storageKey, raw] of entries) {
      if (raw == null) continue;
      const key = storageKey.slice(STORAGE_PREFIX.length) as keyof AppSettings;
      try {
        (next as unknown as Record<string, unknown>)[key] = JSON.parse(raw);
      } catch {
        /* ignore malformed value */
      }
    }
    state = next;
  } catch {
    /* fall back to defaults */
  }
  hydrated = true;
  emit();
}

export function getSettings(): AppSettings {
  return state;
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  emit();
  AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)).catch(() => {});
}

export function updateSettings(patch: Partial<AppSettings>): void {
  state = { ...state, ...patch };
  emit();
  const entries = Object.entries(patch).map(
    ([k, v]): [string, string] => [STORAGE_PREFIX + k, JSON.stringify(v)]
  );
  AsyncStorage.multiSet(entries).catch(() => {});
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive settings hook. */
export function useSettings(): AppSettings {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );
}

export function useSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return useSettings()[key];
}
