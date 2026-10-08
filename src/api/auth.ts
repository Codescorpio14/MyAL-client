import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { fetchJson, formBody } from '@/api/http';

/**
 * OAuth 2.0 + PKCE (`plain`) — port of LogInPageFragment/LogInViewModel.
 * The OAuth client id is public app configuration, not a client secret.
 */
export const MAL_CLIENT_ID = '183063f74126e7551b00c3b4de66986c';

export const MAL_AUTHORIZE_URL = (codeChallenge: string) =>
  'https://myanimelist.net/v1/oauth2/authorize?response_type=code&' +
  `client_id=${MAL_CLIENT_ID}&` +
  'state=signin&' +
  `code_challenge=${codeChallenge}&` +
  'code_challenge_method=plain';

/** 50-char uppercase+digits verifier — LogInViewModel.RandomString(50). */
export function randomPkceChallenge(length = 50): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
    return out;
  }
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

interface TokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

interface AccountResponse {
  id: number;
  name: string;
  picture?: string;
}

const KEY = {
  accessToken: 'auth:accessToken',
  refreshToken: 'auth:refreshToken',
  expiresAt: 'auth:expiresAt',
  username: 'auth:username',
  userId: 'auth:userId',
  authenticated: 'auth:authenticated',
  cookies: 'auth:cookies',
  picture: 'auth:picture',
};

const SECURE_KEYS = [
  KEY.accessToken,
  KEY.refreshToken,
  KEY.expiresAt,
  KEY.cookies,
] as const;

/* ------------------------------------------------------------------ */
/* Credential state (observable, mirrors Credentials + Settings.Auth)  */
/* ------------------------------------------------------------------ */

export interface AuthState {
  authenticated: boolean;
  username: string;
  userId: number | null;
  /** Website session cookies captured during login (used by scraping). */
  cookies: string;
  /** Avatar url from `users/@me` (drawer profile row). */
  picture: string;
}

let authState: AuthState = { authenticated: false, username: '', userId: null, cookies: '', picture: '' };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export async function hydrateAuth(): Promise<void> {
  const entries = await AsyncStorage.multiGet([
    KEY.authenticated,
    KEY.username,
    KEY.userId,
    KEY.picture,
    ...SECURE_KEYS,
  ]);
  const map = Object.fromEntries(entries);
  for (const key of SECURE_KEYS) {
    const legacyValue = map[key];
    if (legacyValue === null || legacyValue === undefined) continue;
    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue === null) await SecureStore.setItemAsync(key, legacyValue);
  }
  await AsyncStorage.multiRemove(SECURE_KEYS);
  const cookies = await SecureStore.getItemAsync(KEY.cookies);
  authState = {
    authenticated: map[KEY.authenticated] === 'true',
    username: map[KEY.username] ?? '',
    userId: map[KEY.userId] ? Number(map[KEY.userId]) : null,
    cookies: cookies ?? '',
    picture: map[KEY.picture] ?? '',
  };
  emit();
}

export function getAuth(): AuthState {
  return authState;
}

async function persist(patch: Partial<AuthState>): Promise<void> {
  authState = { ...authState, ...patch };
  emit();
  if (patch.cookies !== undefined) {
    if (patch.cookies) await SecureStore.setItemAsync(KEY.cookies, patch.cookies);
    else await SecureStore.deleteItemAsync(KEY.cookies);
  }
  const entries: [string, string][] = [];
  if (patch.authenticated !== undefined) entries.push([KEY.authenticated, String(patch.authenticated)]);
  if (patch.username !== undefined) entries.push([KEY.username, patch.username]);
  if (patch.userId !== undefined) entries.push([KEY.userId, String(patch.userId ?? '')]);
  if (patch.picture !== undefined) entries.push([KEY.picture, patch.picture]);
  if (entries.length) await AsyncStorage.multiSet(entries);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => authState,
    () => authState
  );
}

/* ------------------------------------------------------------------ */
/* Token lifecycle                                                     */
/* ------------------------------------------------------------------ */

async function storeTokens(tokens: TokenResponse): Promise<void> {
  // Original subtracts 1h from the expiry to refresh proactively.
  const expiresAt = Date.now() + Math.max(0, tokens.expires_in - 3600) * 1000;
  await Promise.all([
    SecureStore.setItemAsync(KEY.accessToken, tokens.access_token),
    SecureStore.setItemAsync(KEY.refreshToken, tokens.refresh_token),
    SecureStore.setItemAsync(KEY.expiresAt, String(expiresAt)),
  ]);
}

let tokenRequest: Promise<string | null> | null = null;

/** Returns a valid access token, refreshing when < 1h remains. Null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (tokenRequest) return tokenRequest;
  tokenRequest = (async () => {
    try {
      const [accessToken, expiresRaw] = await Promise.all([
        SecureStore.getItemAsync(KEY.accessToken),
        SecureStore.getItemAsync(KEY.expiresAt),
      ]);
      const expiresAt = expiresRaw ? Number(expiresRaw) : 0;
      if (!accessToken) return null;
      if (Date.now() < expiresAt) return accessToken;

      const refreshToken = (await SecureStore.getItemAsync(KEY.refreshToken)) ?? '';
      if (!refreshToken) return accessToken; // may still be valid; server will reject if not

      const tokens = await fetchJson<TokenResponse>('https://myanimelist.net/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody({
          client_id: MAL_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });
      await storeTokens(tokens);
      return tokens.access_token;
    } catch {
      return null;
    }
  })();
  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

/* ------------------------------------------------------------------ */
/* Sign in / out                                                       */
/* ------------------------------------------------------------------ */

export type SignInResult = { ok: true } | { ok: false; reason: string };

/**
 * Mirrors `LogInViewModel.SignIn(cookies, code)`:
 * exchange the authorization code, then fetch `users/@me`.
 */
export async function completeSignIn(cookies: string, code: string, verifier: string): Promise<SignInResult> {
  try {
    const tokens = await fetchJson<TokenResponse>('https://myanimelist.net/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        client_id: MAL_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
      }),
    });
    await storeTokens(tokens);

    const bearer = await getAccessToken();
    if (!bearer) throw new Error('No access token');

    const me = await fetchJson<AccountResponse>('https://api.myanimelist.net/v2/users/@me?fields=id,name,picture', {
      headers: { Authorization: `Bearer ${bearer}` },
    });

    await persist({
      authenticated: true,
      username: me.name,
      userId: me.id,
      cookies: cookies ?? '',
      picture: me.picture ?? '',
    });
    return { ok: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'Authorization failed.';
    await Promise.all(SECURE_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
    await persist({
      authenticated: false,
      username: '',
      userId: null,
      cookies: '',
      picture: '',
    });
    return { ok: false, reason };
  }
}

export async function signOut(): Promise<void> {
  await Promise.all([
    AsyncStorage.multiRemove([
      KEY.authenticated,
      KEY.username,
      KEY.userId,
      KEY.picture,
    ]),
    ...SECURE_KEYS.map((key) => SecureStore.deleteItemAsync(key)),
  ]);
  authState = { authenticated: false, username: '', userId: null, cookies: '', picture: '' };
  emit();
}

/** Fetches `users/@me` and caches id/name/avatar (used after launch/sign-in). */
export async function refreshProfile(): Promise<void> {
  const bearer = await getAccessToken();
  if (!bearer) return;
  try {
    const me = await fetchJson<AccountResponse>('https://api.myanimelist.net/v2/users/@me?fields=id,name,picture', {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    await persist({ authenticated: true, username: me.name, userId: me.id, picture: me.picture ?? '' });
  } catch {
    /* token likely revoked */
  }
}
