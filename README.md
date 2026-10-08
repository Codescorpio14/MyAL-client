<h1 align="center">MyAl-Client</h1>

<p align="center">
  <img src="images/app-logo.png" width="150px">
  <br><br>
  Robust MyAnimeList client application interfacing with the official MAL API, available on Android.
</p>

> This is a full rebuilt of the app using modern stack React Native and Expo [original MALClient by Drutol](https://github.com/Drutol/MALClient).

MyAl-Client is an **open-source project**, and contributions are welcome and
greatly appreciated. The app is still in beta and has unfinished features, so
help with bug fixes, testing, documentation, accessibility, and completing
missing features is especially valuable. Contributions help me finish and
maintain the project for everyone.

Some listed features are still in progress or may not work in every situation;
bug reports and tested fixes are welcome.

> **Important note:** most metadata (details, themes, episodes, seasonal, studios, genres, search, favourites) is served by the **Tenrai API** (**`https://api.tenrai.org/v1`**). Top anime/top manga and the "Adapted to anime" section are scraped directly from MyAnimeList. The official MAL API is used for the anime/manga list, search and scores.

Get the latest signed APK from [Releases](https://github.com/Codescorpio14/MyAL-client/releases).

### Features

- Anime and manga list updates.
  - Score, Status, Episodes, Volumes
  - Tags
  - Favourites
  - Start/End date
  - Rewatching
- Anime list with sorting, filters.
  - Grid view
  - Compact view
  - Detailed grid view
- Anime info.
  - Genres
  - Episodes
  - Reviews
  - Recommendations
  - Personalized anime/manga suggestions.
  - Related
  - Characters & Staff
  - Mal statistics
  - Promotional videos
- Top anime/manga with real MyAnimeList categories (top manga: All, Manga, Novels, Light Novels, One Shots, Doujinshi, Manhwa, Manhua, Popular, Favourited).
  - Category switcher in the top status bar and the ⋮ overflow menu.
- "Adapted to anime" manga section (All / Airing Now / Upcoming Anime).
- Seasonal anime
  - With multiple season selection (ordered by date, current season marked, default sort by MAL score)
- Anime by studio and genre
- Global anime & manga recommendations
- Calendar
  - With countdowns to next episode
- Mal articles
  - Mal news
- Mal messaging
- Tons of settings
- Mal profile
  - With navigation across other's profiles
  - Profile comments, you can add new ones too!
  - Profile comment converstion
- Forums
  - As native as it's possible, not wrapped website.
- System toasts/notifications and notification hub!
- Friends feeds parsed from rss channels.
- History.
- And much more!

### Contributing

1. Fork [the repository](https://github.com/Codescorpio14/MyAL-client) and
   create a branch for your change.
2. Install dependencies with `npm install`.
3. Run the app with `npx expo start` (scan the QR code with Expo Go) and make
   your change.
4. Before opening a pull request, run `npm run check` and, for Android-facing
   changes, `npx expo export --platform android`.
5. Open a pull request describing the change and any testing performed. For
   larger changes, opening an issue first is appreciated.

Please keep pull requests focused, avoid including credentials or signing keys,
and report bugs through the repository's
[Issues](https://github.com/Codescorpio14/MyAL-client/issues).

### License

This project is released under the
[GNU General Public License v3.0](./LICENSE), in keeping with the license of
the legacy MALClient project on which this port is based. Third-party
dependencies and assets remain subject to their respective licenses.
