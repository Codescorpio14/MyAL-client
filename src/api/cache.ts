import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSettings } from '@/store/settings';

/**
 * Port of `MALClient.XShared/BL/DataCache` — JSON file cache with
 * `{ DateTime, payload }` envelopes, now backed by AsyncStorage.
 * Keys are namespaced as `cache:{folder}:{key}` (folder = original subdirectory).
 */

interface Envelope<T> {
  /** epoch ms */
  t: number;
  v: T;
}

const PREFIX = 'cache:';

function fullKey(folder: string, key: string): string {
  return `${PREFIX}${folder}:${key}`;
}

export async function cacheGet<T>(folder: string, key: string): Promise<{ value: T; ageMs: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(fullKey(folder, key));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Envelope<T>;
    if (envelope == null || typeof envelope.t !== 'number') return null;
    return { value: envelope.v, ageMs: Date.now() - envelope.t };
  } catch {
    return null;
  }
}

export async function cacheSet<T>(folder: string, key: string, value: T): Promise<void> {
  const envelope: Envelope<T> = { t: Date.now(), v: value };
  try {
    await AsyncStorage.setItem(fullKey(folder, key), JSON.stringify(envelope));
  } catch {
    /* storage full — ignore */
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CachedQueryOptions {
  /** TTL in days — mirrors the per-type constants in DataCache. */
  ttlDays: number;
  /** Ignore the cache and refetch. */
  force?: boolean;
  /** When offline, return a stale value instead of throwing. Default true. */
  staleWhenOffline?: boolean;
}

/**
 * Cache-first query. Returns cached data when fresh; otherwise calls
 * `fetcher`, stores the result and returns it. If the fetch fails and a
 * stale entry exists (offline scenario), the stale entry is returned.
 */
export async function cachedQuery<T>(
  folder: string,
  key: string,
  fetcher: () => Promise<T>,
  options: CachedQueryOptions
): Promise<T> {
  const { ttlDays, force = false, staleWhenOffline = true } = options;
  if (!getSettings().cacheEnabled) return fetcher();
  const cached = await cacheGet<T>(folder, key);

  if (!force && cached && cached.ageMs < ttlDays * DAY_MS) {
    return cached.value;
  }

  try {
    const value = await fetcher();
    await cacheSet(folder, key, value);
    return value;
  } catch (err) {
    if (staleWhenOffline && cached) return cached.value;
    throw err;
  }
}

/** Wipe one folder, or everything when folder is omitted. */
export async function clearCache(folder?: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const targets = keys.filter((k) =>
    folder ? k.startsWith(`${PREFIX}${folder}:`) : k.startsWith(PREFIX)
  );
  if (targets.length) await AsyncStorage.multiRemove(targets);
}

/** Mirrors `DataCache.ClearApiRelatedCache()` called after sign-in/out. */
export async function clearApiRelatedCache(): Promise<void> {
  await clearCache('api');
}
