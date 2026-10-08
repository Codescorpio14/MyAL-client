# MyAl-Client (Beta)

An Expo / React Native Android client porting features from the legacy
`MALClient-main` application.

## Run

```bash
npm install
npx expo start
```

Press `a` to open the app on a connected Android emulator/device, or scan the
development-server QR code with Expo Go. MAL sign-in uses the app's embedded
OAuth authorization page: sign in to MAL, approve the app if prompted, then
the returned authorization code is exchanged for saved access/refresh tokens
and the signed-in profile.

OAuth access/refresh tokens and the MAL website session cookies are stored with
Expo SecureStore (Android Keystore-backed encrypted storage / iOS Keychain).
Existing credentials are migrated from AsyncStorage on first launch after this
update. The MAL OAuth client ID in the source is public application
configuration, not a private client secret. Do not put user tokens, signing
keys, or Expo access tokens in source control or a bundled `.env` file.

## Current port

The app currently includes MAL sign-in, anime and manga lists with list
updates, search, anime/manga details, character and person details, a user
profile with favorites and friends, MAL articles and news with an in-app
reader, recent anime/manga community recommendations, the weekly calendar, and
persisted appearance/list/calendar preferences. The profile includes general
information, anime/manga statistics, recent updates, favorites, and friends.
Community features include native forum boards, recent topics, thread reading,
topic creation, and replies; searchable club listings and native club detail
pages with membership and comment actions; and grouped public profile history
with links to anime/manga details.
Promotional videos have an in-app catalog with links to YouTube and anime
details. Settings and the signed-in user's profile are available from the
navigation drawer.

The port is not yet at full legacy parity. Forum pagination and
moderation/editing tools are not ported. The Friends Feed, Adapted to Anime,
image feed, list comparison, and wallpapers are not currently included.

## Signed beta APK releases

The app version is `0.7.0-beta.1` and the Android application ID is
`com.codescorpio.myalclinet`. Keep the application ID and signing key stable
for all future updates so Android accepts new APKs as updates to existing
installations.

APK releases are built on EAS and published to GitHub when a matching version
tag is pushed. One-time setup:

1. Create/sign in to your Expo account, then run `npx eas-cli login` and
   `npx eas-cli init` from this project. Commit the generated EAS project ID.
2. Run `npx eas-cli build --platform android --profile release` once
   interactively and have EAS create and retain the Android signing keystore.
   Keep that credential in your Expo account; never download it into the repo
   or commit it.
3. Create an Expo access token and add it to the GitHub repository as an
   Actions secret named `EXPO_TOKEN`.
4. Update `package.json` and `app.json` versions together and increment
   `android.versionCode` in `app.json`. Commit and push, then push a matching
   tag, for example:

   ```bash
   git tag v0.7.0-beta.1
   git push origin v0.7.0-beta.1
   ```

GitHub Actions builds a signed APK with the EAS-managed key and attaches it,
along with a SHA-256 checksum and signing-certificate fingerprint, to a GitHub
Release. The release tag must match the `package.json` version. Users can
verify file integrity with
`sha256sum -c MyAl-Client-v0.7.0-beta.1.apk.sha256` and compare the published
certificate fingerprint across releases. Android also rejects an update that
is signed by a different certificate. Preserve the same EAS keystore for every
update; a different certificate will not update an already-installed copy.

Local `.env*` files, signing materials, and generated APKs are ignored by Git.
Runtime user credentials belong in SecureStore, not environment files.

## Checks

```bash
npm run lint
npm run typecheck
npm run check
```

## First Android test

Start Expo and open the app on an Android emulator/device:

```bash
npm run android
```

If Android SDK tools are installed, this task opens the connected emulator.
Without `adb`, it starts the Expo dev server and prints a QR code; install Expo
Go on an Android phone and scan that QR code to test without Android Studio.

To enable emulator auto-launch on Linux, install Android Studio and install the
Android SDK plus Platform-Tools from Android Studio's SDK Manager. Then add the
SDK path to your Fish shell configuration and restart the terminal:

```fish
set -Ux ANDROID_HOME "$HOME/Android/Sdk"
set -Ux ANDROID_SDK_ROOT "$ANDROID_HOME"
fish_add_path "$ANDROID_HOME/platform-tools" "$ANDROID_HOME/emulator" "$ANDROID_HOME/cmdline-tools/latest/bin"
```

Check the setup with `adb version` and `adb devices`, then run `npm run android`
again. If the SDK is installed in a different location, set `ANDROID_HOME` to
that path instead.

Smoke-test sign-in (including MAL's app-access approval) and sign-out, confirm
the signed-in username/profile appears, then test the anime and manga lists,
details navigation, search, list updates, profile tabs, calendar preferences,
drawer destinations, refresh, and offline/error states. Account-only pages and
personalized recommendations require a MAL account. Test club membership and
comment actions plus forum topic creation and replies while signed in. Messages
and notifications are native screens that require a signed-in MAL account.

For a release-mode JavaScript bundle check:

```bash
npx expo export --platform android
```
