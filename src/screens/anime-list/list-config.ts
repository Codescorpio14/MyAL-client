import { statusToString } from '@/api/status';
import { ListKind, SortOption, SORT_LABELS, WorkMode } from '@/api/types';

/**
 * Per-work-mode configuration — port of the `switch (WorkMode)` block in
 * `AnimeListViewModel.OnNavigatedTo` + `UpdateUpperStatus` (titles) and the
 * label helpers `Filter1Label`/`Filter5Label`/`Sort3Label`/`StatusAllLabel`
 * in `AnimeListViewModels.ui.cs`.
 */
export interface ModeConfig {
  mode: WorkMode;
  kind: ListKind;
  /** Own anime/manga list (has list source, editable entries). */
  isOwnList: boolean;
  /** `AppbarBtnPinTileVisibility` — calendar button in the bottom bar. */
  pinTile: boolean;
  /** `AppBtnSortingVisibility` — sort button in the bottom bar. */
  sortingEnabled: boolean;
  /** `AppBtnListSourceVisibility` — "Set list source" long-press entry. */
  listSourceEnabled: boolean;
  /** Top/genre/studio/adapted lists keep the API's index order for `SortWatched`. */
  naturalOrder: boolean;
  defaultSort: SortOption;
  /** `Sort3Label` — label shown for SortWatched. */
  sort3Label: string;
  /** `StatusAllLabel`. */
  statusAllLabel: string;
  /** `Filter1Label`. */
  filter1Label: string;
  /** `Filter5Label`. */
  filter5Label: string;
}

export function modeConfig(mode: WorkMode): ModeConfig {
  switch (mode) {
    case 'Manga':
      return {
        mode,
        kind: 'manga',
        isOwnList: true,
        pinTile: false,
        sortingEnabled: true,
        listSourceEnabled: true,
        naturalOrder: false,
        defaultSort: 'SortTitle',
        sort3Label: 'Read',
        statusAllLabel: 'All',
        filter1Label: 'Reading',
        filter5Label: 'Plan to read',
      };
    case 'Anime':
      return {
        mode,
        kind: 'anime',
        isOwnList: true,
        pinTile: false,
        sortingEnabled: true,
        listSourceEnabled: true,
        naturalOrder: false,
        defaultSort: 'SortTitle',
        sort3Label: 'Watched',
        statusAllLabel: 'All',
        filter1Label: 'Watching',
        filter5Label: 'Plan to watch',
      };
    case 'SeasonalAnime':
      return {
        mode,
        kind: 'anime',
        isOwnList: false,
        pinTile: true,
        sortingEnabled: true,
        listSourceEnabled: false,
        naturalOrder: true,
        defaultSort: 'SortWatched',
        sort3Label: 'Popularity',
        statusAllLabel: 'All',
        filter1Label: 'Watching',
        filter5Label: 'Plan to watch',
      };
    case 'TopAnime':
    case 'AnimeByGenre':
    case 'AnimeByStudio':
      return {
        mode,
        kind: 'anime',
        isOwnList: false,
        pinTile: false,
        sortingEnabled: mode !== 'TopAnime',
        listSourceEnabled: false,
        naturalOrder: true,
        defaultSort: 'SortWatched',
        sort3Label: 'Index',
        statusAllLabel: 'All',
        filter1Label: 'Watching',
        filter5Label: 'Plan to watch',
      };
    case 'TopManga':
    case 'MangaAdapted':
      return {
        mode,
        kind: 'manga',
        isOwnList: false,
        pinTile: false,
        sortingEnabled: mode !== 'TopManga' && mode !== 'MangaAdapted',
        listSourceEnabled: false,
        naturalOrder: true,
        defaultSort: 'SortWatched',
        sort3Label: 'Index',
        statusAllLabel: 'All',
        filter1Label: 'Reading',
        filter5Label: 'Plan to read',
      };
    default:
      return {
        mode,
        kind: 'anime',
        isOwnList: false,
        pinTile: false,
        sortingEnabled: true,
        listSourceEnabled: false,
        naturalOrder: true,
        defaultSort: 'SortWatched',
        sort3Label: 'Index',
        statusAllLabel: 'All',
        filter1Label: 'Watching',
        filter5Label: 'Plan to watch',
      };
  }
}

/** `SetDesiredStatus(null)` — own lists start on Watching, everything else on All. */
export function defaultStatusInt(config: ModeConfig): number {
  return config.isOwnList ? 1 : 7;
}

/** `CapitalizeSeason + year` — "winter 2026" → "Winter 2026". */
export function seasonLabel(name: string, year: number): string {
  const cap = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  return `${cap} ${year}`;
}

/** `AnimeAdaptedToAnimeQuery.ToDisplayName`. */
export function adaptedLabel(type: string): string {
  switch (type) {
    case 'AiringNow':
      return 'Airing Now';
    case 'UpcomingAnime':
      return 'Upcoming Anime';
    default:
      return 'All';
  }
}

/** Subtitle under the title — `CurrentStatusSub` (sort label). */
export function sortSubtitle(config: ModeConfig, option: SortOption): string {
  if (!config.isOwnList && !config.pinTile && config.naturalOrder && !config.sortingEnabled) return '';
  return option === 'SortWatched' ? config.sort3Label : SORT_LABELS[option];
}

export interface TitleContext {
  listSource?: string;
  season?: string;
  topType?: string;
  adaptedType?: string;
  genreName?: string;
  studioName?: string;
}

/** App bar title — port of `AnimeListViewModel.UpdateUpperStatus`. */
export function buildTitle(
  config: ModeConfig,
  statusInt: number,
  sortOption: SortOption,
  ctx: TitleContext
): { title: string; subtitle: string } {
  const status = statusToString(statusInt, config.kind);
  const subtitle = sortSubtitle(config, sortOption);
  const joined = (label: string) => ({
    title: config.isOwnList ? `${label} - ${status}` : label,
    subtitle,
  });

  switch (config.mode) {
    case 'TopAnime':
      return joined(`Top ${ctx.topType ?? 'General'}`);
    case 'TopManga':
      return joined(`Top ${ctx.topType === 'All' || !ctx.topType ? 'Manga' : ctx.topType}`);
    case 'MangaAdapted':
      return {
        title: `Adapted to anime - ${adaptedLabel(ctx.adaptedType ?? 'All')}`,
        subtitle: '',
      };
    case 'AnimeByStudio':
      return { title: `Studio - ${ctx.studioName ?? ''}`, subtitle };
    case 'AnimeByGenre':
      return { title: `Genre - ${ctx.genreName ?? ''}`, subtitle };
    case 'SeasonalAnime':
      return joined(ctx.season ?? 'Seasonal');
    default: {
      const source = ctx.listSource;
      if (!source) return { title: config.kind === 'manga' ? 'Manga list' : 'Anime list', subtitle };
      return joined(source);
    }
  }
}
