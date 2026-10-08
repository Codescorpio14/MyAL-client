import { loadList } from '@/api/library';
import { LibraryItem } from '@/api/types';
import { AppSettings, getSettings } from '@/store/settings';

/**
 * Calendar data plumbing — port of `CalendarPageViewModel.Init`
 * (MALClient.XShared/ViewModels/Main/CalendarPageViewModel.cs).
 *
 * The original builds its week from the user's own list
 * (`AllLoadedAuthAnimeItems`: TV entries that are Watching or Plan to watch,
 * capped at 40, watching first) intersected with a private airing feed
 * (`AiringInfoProvider` → `https://mylovelyvps.xyz/malclient/airing.json`), which
 * supplies the airing day. That feed is not part of this port, so the broadcast
 * day/time MAL reports for the current season (`fetchSeasonal` → `broadcast`,
 * exposed as `airDay`/`airTime`) takes its place.
 */

/** `Utilities.DayToString(DayOfWeek, true)` — exact 3-letter tab headers. */
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `Utilities.ShortDayToFullDay` — summary section headers ("Tuesday"). */
export const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Limit items to 40 at most" — watching entries keep priority. */
const MAX_ENTRIES = 40;

/** MAL's `broadcast` is expressed in JST. */
const JST_OFFSET = 9 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A library entry with the calendar's precomputed overlay strings. */
export interface CalendarEntry extends LibraryItem {
  /** `TopLeftInfoBind` — short broadcast day ("Sun"), "" when unknown. */
  dayShort: string;
  /** `AirDayTillBind` — "3d" / "5h" / "22m" / "Aired!", "" when unknown. */
  airDayTill: string;
  /** `AirDayBrush` — gray top-left text when there is no airing info. */
  dayGray: boolean;
  /** `TimeTillNextAirCache` — "2d 4h 12m" / "Aired today!", "" when unknown. */
  timeTillAir: string;
}

export interface CalendarDay {
  /** Tab key — `d0` (Sunday) … `d6` (Saturday). */
  key: string;
  index: number;
  /** `CalendarPivotPage.Header` — "Sun". */
  short: string;
  /** `CalendarPivotPage.FullHeader` — "Sunday". */
  full: string;
  /** `CalendarPivotPage.Sub` — item count, "-" for empty days. */
  sub: string;
  items: CalendarEntry[];
}

/** One `CalendarSummaryPivotPage.Data` tuple ("Sunday" → its items). */
export interface SummaryGroup {
  full: string;
  items: CalendarEntry[];
}

export interface CalendarModel {
  days: CalendarDay[];
  summary: SummaryGroup[];
}

/** `Settings.CalendarStartOnToday` — the original's tab index for "today". */
export function todayTabKey(now: Date = new Date()): string {
  return `d${now.getDay()}`;
}

function parseAirTime(airTime: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(airTime.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

/**
 * Next occurrence of `airDay`/`airTime` (JST) as a Unix timestamp.
 * Mirrors `AiringInfoProvider.TryGetNextAirDate`: when the show airs later
 * today, *today's* timestamp is returned even if it already passed.
 */
export function nextAirTimestamp(airDay: number, airTime: string): number | null {
  const parsed = parseAirTime(airTime);
  if (!parsed) return null;
  const { hour, minute } = parsed;

  const now = Date.now();
  const jst = new Date(now + JST_OFFSET);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth();
  const day = jst.getUTCDate();

  for (let offset = 0; offset <= 7; offset++) {
    if (weekdayOf(year, month, day + offset) !== airDay) continue;
    const stamp = Date.UTC(year, month, day + offset, hour, minute) - JST_OFFSET;
    // Today stays even when it already aired ("Aired today!"), otherwise take
    // the next future occurrence.
    if (offset === 0 || stamp > now) return stamp;
  }
  return null;
}

/** `AnimeItemViewModel.AirDayTillBind` — "3d" / "5h" / "42m" / "Aired!". */
export function airDayTillText(diffMs: number): string {
  if (diffMs < 0) return 'Aired!';
  if (diffMs >= DAY_MS) return `${Math.round(diffMs / DAY_MS)}d`;
  if (diffMs >= HOUR_MS) return `${Math.round(diffMs / HOUR_MS)}h`;
  return `${Math.round(diffMs / MINUTE_MS)}m`;
}

/** `AnimeItemViewModel.GetTimeTillNextAir` — "2d 4h 12m" / "4h 12m" / "12m". */
export function timeTillAirText(airTimestamp: number): string {
  const diffMs = airTimestamp - Date.now();
  if (diffMs < 0) return 'Aired today!';
  const days = Math.floor(diffMs / DAY_MS);
  const hours = Math.floor((diffMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((diffMs % HOUR_MS) / MINUTE_MS);
  if (diffMs > DAY_MS) return `${days}d ${hours}h ${minutes}m`;
  if (diffMs > HOUR_MS) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function toEntry(item: LibraryItem): CalendarEntry {
  const airDay = item.airDay;
  const airTimestamp =
    typeof airDay === 'number' && airDay >= 0 && airDay <= 6 && item.airTime
      ? nextAirTimestamp(airDay, item.airTime)
      : null;
  return {
    ...item,
    dayShort: typeof airDay === 'number' && airDay >= 0 && airDay <= 6 ? DAY_SHORT[airDay] : '',
    airDayTill: airTimestamp === null ? '' : airDayTillText(airTimestamp - Date.now()),
    dayGray: airTimestamp === null,
    timeTillAir: airTimestamp === null ? '' : timeTillAirText(airTimestamp),
  };
}

/** `abstraction.Type == AnimeType.TV` plus the Watching/Plan to watch filter. */
function matchesOriginalFilter(
  item: LibraryItem,
  preferences: Pick<AppSettings, 'calendarIncludeWatching' | 'calendarIncludePlanned'>
): boolean {
  if (item.mediaType !== 'tv') return false;
  const watching = preferences.calendarIncludeWatching && item.myStatus === 'watching';
  const planned = preferences.calendarIncludePlanned && item.myStatus === 'plan_to_watch';
  return watching || planned;
}

/** "Limit items to 40 at most … currently watched ones having most priority". */
function limitToForty(items: LibraryItem[]): LibraryItem[] {
  if (items.length <= MAX_ENTRIES) return items;
  const watching = items.filter((item) => item.myStatus === 'watching');
  if (watching.length > MAX_ENTRIES) return watching.slice(0, MAX_ENTRIES);
  const planned = items.filter((item) => item.myStatus !== 'watching');
  return [...watching, ...planned.slice(0, MAX_ENTRIES - watching.length)];
}

/**
 * Builds the 7 day pages + summary page (`CalendarData`), Sunday first
 * (`Settings.CalendarSwitchMonSun` defaults to false). Entries without a
 * broadcast day are dropped, exactly like the original's
 * `TryGetAiringDay` misses.
 */
export async function buildCalendar(
  force = false,
  preferences: Pick<
    AppSettings,
    'calendarIncludeWatching' | 'calendarIncludePlanned' | 'calendarMondayFirst'
  > = getSettings()
): Promise<CalendarModel> {
  const [seasonal, library] = await Promise.all([
    loadList({ workMode: 'SeasonalAnime', kind: 'anime', force }),
    loadList({ workMode: 'Anime', kind: 'anime', force }),
  ]);
  const airing = seasonal.filter((item) => typeof item.airDay === 'number' && item.airDay >= 0 && item.airDay <= 6);
  const personalIds = new Set(library.filter((item) => matchesOriginalFilter(item, preferences)).map((item) => item.id));
  const personal = airing
    .filter((item) => personalIds.has(item.id))
    .map((scheduleItem) => {
      const ownItem = library.find((item) => item.id === scheduleItem.id);
      return ownItem
        ? { ...scheduleItem, ...ownItem, airDay: scheduleItem.airDay, airTime: scheduleItem.airTime }
        : scheduleItem;
    });
  const source = preferences.calendarIncludeWatching || preferences.calendarIncludePlanned
    ? limitToForty(personal.length > 0 ? personal : airing)
    : [];

  const days: CalendarDay[] = DAY_SHORT.map((short, index) => ({
    key: `d${index}`,
    index,
    short,
    full: DAY_FULL[index],
    sub: '-',
    items: [],
  }));

  for (const item of source) {
    const day = item.airDay;
    if (typeof day !== 'number' || day < 0 || day > 6) continue;
    days[day].items.push(toEntry(item));
  }

  for (const day of days) {
    day.sub = day.items.length > 0 ? String(day.items.length) : '-';
  }

  // `CalendarSummaryPivotPage` — only days that actually have entries.
  const orderedDays = preferences.calendarMondayFirst ? [...days.slice(1), days[0]] : days;
  const summary = orderedDays
    .filter((day) => day.items.length > 0)
    .map((day) => ({ full: day.full, items: day.items }));

  return { days: orderedDays, summary };
}
