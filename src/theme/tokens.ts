/**
 * Design tokens extracted 1:1 from the original MALClient Android resources:
 *  - MALClient.Android/Resources/values/colors.xml   (143 color resources)
 *  - MALClient.Android/Resources/values/dimens.xml
 *  - MALClient.Android/Resources/values/fonts.xml
 *
 * NOTE ON ALPHA: Android colors are #AARRGGBB, React Native expects #RRGGBBAA.
 * Every alpha color below has already been converted.
 */

export type AccentName = 'orange' | 'purple' | 'blue' | 'lime' | 'pink' | 'cyan' | 'red' | 'skyblue';

export interface AccentPalette {
  key: AccentName;
  label: string;
  /** AccentColour */
  base: string;
  /** AccentColourDark */
  dark: string;
  /** AccentColourLight */
  light: string;
  /** OpaqueAccentColour (50%) */
  opaque: string;
  /** AccentColourContrast (text/icon color that goes on top of the accent) */
  contrast: string;
  /** Message bubbles, dark theme: [mine, other] */
  bubbleDark: [string, string];
  /** Message bubbles, light theme: [mine, other] */
  bubbleLight: [string, string];
}

export const ACCENTS: AccentPalette[] = [
  {
    key: 'orange',
    label: 'Orange',
    base: '#FF8C00',
    dark: '#CC7000',
    light: '#FFAF4D',
    opaque: '#FF8C007F',
    contrast: '#FF8C00',
    bubbleDark: ['#7D340E', '#6A2D0D'],
    bubbleLight: ['#EAB995', '#E4A787'],
  },
  {
    key: 'purple',
    label: 'Purple',
    base: '#881798',
    dark: '#5A1663',
    light: '#9E27AE',
    opaque: '#8817987F',
    contrast: '#881798',
    bubbleDark: ['#56125F', '#491150'],
    bubbleLight: ['#CFA2D6', '#C38BCB'],
  },
  {
    key: 'blue',
    label: 'Blue',
    base: '#0063B1',
    dark: '#0C4674',
    light: '#1474C0',
    opaque: '#0063B17F',
    contrast: '#FBB000',
    bubbleDark: ['#043F6E', '#05375E'],
    bubbleLight: ['#99C1E0', '#7FB1D8'],
  },
  {
    key: 'lime',
    label: 'Lime',
    base: '#98C926',
    dark: '#6E8E21',
    light: '#A9CF2F',
    opaque: '#98C9267F',
    contrast: '#A3218E',
    bubbleDark: ['#5F7C1A', '#516918'],
    bubbleLight: ['#D5E9A8', '#CCE493'],
  },
  {
    key: 'pink',
    label: 'Pink',
    base: '#F754A2',
    dark: '#A8346B',
    light: '#FF97C9',
    opaque: '#F754A27F',
    contrast: '#F754A2',
    bubbleDark: ['#983665', '#802F56'],
    bubbleLight: ['#FBBAD9', '#FBAAD1'],
  },
  {
    key: 'cyan',
    label: 'Cyan',
    base: '#2DC6C6',
    dark: '#00A1A4',
    light: '#1CCFA2',
    opaque: '#2DC6C67F',
    contrast: '#2DC6C6',
    bubbleDark: ['#08A4A7', '#07888B'],
    bubbleLight: ['#86FFE0', '#67FFD8'],
  },
  {
    key: 'red',
    label: 'Red',
    base: '#DE2909',
    dark: '#970000',
    light: '#E85050',
    opaque: '#DE29097F',
    contrast: '#DE2909',
    bubbleDark: ['#B60000', '#940000'],
    bubbleLight: ['#FF745B', '#FF5132'],
  },
  {
    key: 'skyblue',
    label: 'SkyBlue',
    base: '#00A1E9',
    dark: '#0076AB',
    light: '#35C1FF',
    opaque: '#00A1E97F',
    contrast: '#00A1E9',
    bubbleDark: ['#006ECC', '#004E8F'],
    bubbleLight: ['#6CD2FF', '#28BDFF'],
  },
];

export const ACCENT_BY_KEY: Record<AccentName, AccentPalette> = ACCENTS.reduce(
  (acc, a) => ({ ...acc, [a.key]: a }),
  {} as Record<AccentName, AccentPalette>
);

/** The 34 `?Brush*` theme attributes, per light/dark theme. */
export interface Brushes {
  text: string;
  textInverted: string;
  deepBackground: string;
  appBars: string;
  appBarText: string;
  /** Top app bar background. Light themes use the accent colour. */
  appBarUpper: string;
  pivotHeaderBackground: string;
  pivotInnerHeaderBarBackground: string;
  hamburgerBackground: string;
  hamburgerInnerBackground: string;
  animeItemBackground: string;
  animeItemInnerBackground: string;
  /** 74% alpha loading overlay */
  loading: string;
  loadingNonTransparent: string;
  loadingNonOpaque: string;
  rowAlternate1: string;
  rowAlternate2: string;
  rowAlternate2Lighter: string;
  detailsGeneralBorder: string;
  detailsBackground: string;
  detailsUpperBackground: string;
  detailsRelatedBackground: string;
  detailsMoreButton: string;
  newsBackground: string;
  settingsSubtitle: string;
  favouriteStarBackground: string;
  noSearchResults: string;
  mediaElementShadow: string;
  forumPinnedBoard: string;
  buttonPressed: string;
  flyoutBackground: string;
  selectedDialogItem: string;
}

const LIGHT: Omit<Brushes, 'appBarUpper'> = {
  text: '#000000',
  textInverted: '#FFFFFF',
  deepBackground: '#E6E6E6',
  appBars: '#D3D3D3',
  appBarText: '#FFFFFF',
  pivotHeaderBackground: '#DADADA',
  pivotInnerHeaderBarBackground: '#E6E6E6',
  hamburgerBackground: '#E6E6E6',
  hamburgerInnerBackground: '#FFFFFF',
  animeItemBackground: '#F5F5F5',
  animeItemInnerBackground: '#E5E5E5',
  loading: '#E6E6E6B4',
  loadingNonTransparent: '#E6E6E6',
  loadingNonOpaque: '#EFEFEF',
  rowAlternate1: '#F5F5F5',
  rowAlternate2: '#E6E6E6AA',
  rowAlternate2Lighter: '#F0F0F0',
  detailsGeneralBorder: '#D3D3D3',
  detailsBackground: '#F0F0F0',
  detailsUpperBackground: '#E4E4E4',
  detailsRelatedBackground: '#F5F5F5',
  detailsMoreButton: '#E6E6E6',
  newsBackground: '#FFFFFF',
  settingsSubtitle: '#555555',
  favouriteStarBackground: '#FFFFFF',
  noSearchResults: '#B9B9B9',
  mediaElementShadow: '#F5F5F5E5',
  forumPinnedBoard: '#FAFAFABB',
  buttonPressed: '#E0E0E050',
  flyoutBackground: '#F2F2F2',
  selectedDialogItem: '#FFFFFF',
};

const DARK: Omit<Brushes, 'appBarUpper'> = {
  text: '#FFFFFF',
  textInverted: '#000000',
  deepBackground: '#0D0D0D',
  appBars: '#151515',
  appBarText: '#FFFFFF',
  pivotHeaderBackground: '#202020',
  pivotInnerHeaderBarBackground: '#252525',
  hamburgerBackground: '#1A1A1A',
  hamburgerInnerBackground: '#000000',
  animeItemBackground: '#2A2C2A',
  animeItemInnerBackground: '#212121',
  loading: '#2A2C2ABD',
  loadingNonTransparent: '#2A2C2A7F',
  loadingNonOpaque: '#0A0A0A',
  rowAlternate1: '#2A2C2AAA',
  rowAlternate2: '#111111',
  rowAlternate2Lighter: '#111111',
  detailsGeneralBorder: '#151515',
  detailsBackground: '#0D0D0D',
  detailsUpperBackground: '#1A1A1A',
  detailsRelatedBackground: '#1E1E1E',
  detailsMoreButton: '#404040',
  newsBackground: '#2F2F2FBD',
  settingsSubtitle: '#D3D3D3',
  favouriteStarBackground: '#000000BD',
  noSearchResults: '#B9B9B9',
  mediaElementShadow: '#000000E5',
  forumPinnedBoard: '#1515157F',
  buttonPressed: '#E0E0E050',
  flyoutBackground: '#2B2B2B',
  selectedDialogItem: '#1D1D1D',
};

export function buildBrushes(mode: 'light' | 'dark', accent: AccentPalette): Brushes {
  const base = mode === 'light' ? LIGHT : DARK;
  // Light themes: `BrushAppBarUpper = AccentColour`; dark themes keep the app-bar colour.
  const appBarUpper = mode === 'light' ? accent.base : base.appBars;
  return { ...base, appBarUpper };
}

/** Shared (theme independent) semantic colours. */
export const SEMANTIC = {
  watching: '#228B22',
  completed: '#1E90FF',
  onHold: '#FFD700',
  dropped: '#DC143C',
  planned: '#808080',
  notificationRed: '#D63A33',
  supportHeart: '#FF4400',
  white: '#FFFFFF',
  transparent: '#00000000',
  opaqueTextView: '#000000BD',
  textAccentContrast: '#F3F3F3',
  launcherBackground: '#ECECEB',
} as const;

/** values/fonts.xml — Android system Roboto variants. */
export const FONTS = {
  light: 'sans-serif-light',
  medium: 'sans-serif-medium',
  regular: 'sans-serif',
  condensed: 'sans-serif-condensed',
  black: 'sans-serif-black',
  thin: 'sans-serif-thin',
} as const;

/** Type scale (sp) from values/dimens.xml. */
export const FONT_SIZE = {
  tiny: 10,
  small: 13,
  semiNormal: 13,
  normal: 14,
  medium: 16,
  big: 18,
  huge: 20,
  /** Ad-hoc sizes used across layouts */
  appBarTitle: 15,
  appBarSubtitle: 13,
  dialogTitle: 20,
  dialogRow: 18,
  drawerHeader: 26,
} as const;

/** values/dimens.xml + recurring in-layout values. */
export const DIMENS = {
  activityMargin: 16,
  appBarHeight: 50,
  appBarBtn: 50,
  textFlyoutItemHeight: 30,
  textFlyoutItemWidth: 100,
  textFlyoutItemWideWidth: 150,
  showImageWidth: 110,
  showImageHeightSmall: 140,
  showImageWidthMedium: 130,
  showImageHeightMedium: 175,
  incDecButtonWidth: 30,
  hamburgerItemSpacing: 10,
  progressRingSize: 50,
  cardElevation: 2,
  drawerElevation: 5,
  listDivider: 5,
  relatedDivider: 15,
  fabMargin: 16,
  tabStripHeight: 25,
  tabStripHeightTall: 55,
  innerPadding: 5,
  dialogPadding: 20,
  accentRail: 4,
} as const;

export const RADII = {
  /** Everything is square except dialogs and message bubbles. */
  none: 0,
  dialog: 10,
  bubble: 10,
} as const;
