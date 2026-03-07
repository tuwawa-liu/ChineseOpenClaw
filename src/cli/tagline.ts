import { getTaglines } from "../i18n/index.js";
import type { TaglineSet } from "../i18n/types.js";

export type TaglineMode = "random" | "default" | "off";

function getHolidayTaglines(): TaglineSet["holiday"] {
  return getTaglines().holiday;
}

function getAllTaglines(): string[] {
  const tl = getTaglines();
  const holiday = Object.values(tl.holiday);
  return [...tl.lines, ...holiday];
}

type HolidayRule = (date: Date) => boolean;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

const onMonthDay =
  (month: number, day: number): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return parts.month === month && parts.day === day;
  };

const onSpecificDates =
  (dates: Array<[number, number, number]>, durationDays = 1): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return dates.some(([year, month, day]) => {
      if (parts.year !== year) {
        return false;
      }
      const start = Date.UTC(year, month, day);
      const current = Date.UTC(parts.year, parts.month, parts.day);
      return current >= start && current < start + durationDays * DAY_MS;
    });
  };

const inYearWindow =
  (
    windows: Array<{
      year: number;
      month: number;
      day: number;
      duration: number;
    }>,
  ): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    const window = windows.find((entry) => entry.year === parts.year);
    if (!window) {
      return false;
    }
    const start = Date.UTC(window.year, window.month, window.day);
    const current = Date.UTC(parts.year, parts.month, parts.day);
    return current >= start && current < start + window.duration * DAY_MS;
  };

const isFourthThursdayOfNovember: HolidayRule = (date) => {
  const parts = utcParts(date);
  if (parts.month !== 10) {
    return false;
  } // November
  const firstDay = new Date(Date.UTC(parts.year, 10, 1)).getUTCDay();
  const offsetToThursday = (4 - firstDay + 7) % 7; // 4 = Thursday
  const fourthThursday = 1 + offsetToThursday + 21; // 1st + offset + 3 weeks
  return parts.day === fourthThursday;
};

type HolidayKey = "newYear" | "lunarNewYear" | "christmas" | "eid" | "diwali" | "easter" | "hanukkah" | "halloween" | "thanksgiving" | "valentines";

const HOLIDAY_RULES = new Map<HolidayKey, HolidayRule>([
  ["newYear", onMonthDay(0, 1)],
  [
    "lunarNewYear",
    onSpecificDates(
      [
        [2025, 0, 29],
        [2026, 1, 17],
        [2027, 1, 6],
      ],
      1,
    ),
  ],
  [
    "eid",
    onSpecificDates(
      [
        [2025, 2, 30],
        [2025, 2, 31],
        [2026, 2, 20],
        [2027, 2, 10],
      ],
      1,
    ),
  ],
  [
    "diwali",
    onSpecificDates(
      [
        [2025, 9, 20],
        [2026, 10, 8],
        [2027, 9, 28],
      ],
      1,
    ),
  ],
  [
    "easter",
    onSpecificDates(
      [
        [2025, 3, 20],
        [2026, 3, 5],
        [2027, 2, 28],
      ],
      1,
    ),
  ],
  [
    "hanukkah",
    inYearWindow([
      { year: 2025, month: 11, day: 15, duration: 8 },
      { year: 2026, month: 11, day: 5, duration: 8 },
      { year: 2027, month: 11, day: 25, duration: 8 },
    ]),
  ],
  ["halloween", onMonthDay(9, 31)],
  ["thanksgiving", isFourthThursdayOfNovember],
  ["valentines", onMonthDay(1, 14)],
  ["christmas", onMonthDay(11, 25)],
]);

function isHolidayActive(key: string, date: Date): boolean {
  const rule = HOLIDAY_RULES.get(key as HolidayKey);
  if (!rule) {
    return true;
  }
  return rule(date);
}

function isTaglineActive(tagline: string, _allTaglines: string[], holidayTaglines: Record<string, string>, date: Date): boolean {
  // Check if it's a holiday tagline
  for (const [key, text] of Object.entries(holidayTaglines)) {
    if (text === tagline) {
      return isHolidayActive(key, date);
    }
  }
  return true;
}

export interface TaglineOptions {
  env?: NodeJS.ProcessEnv;
  random?: () => number;
  now?: () => Date;
  mode?: TaglineMode;
}

export function activeTaglines(options: TaglineOptions = {}): string[] {
  const taglineSet = getTaglines();
  const allTaglines = getAllTaglines();
  const defaultTagline = taglineSet.default;
  if (allTaglines.length === 0) {
    return [defaultTagline];
  }
  const today = options.now ? options.now() : new Date();
  const filtered = allTaglines.filter((tagline) => isTaglineActive(tagline, allTaglines, taglineSet.holiday, today));
  return filtered.length > 0 ? filtered : allTaglines;
}

export function pickTagline(options: TaglineOptions = {}): string {
  const taglineSet = getTaglines();
  const defaultTagline = taglineSet.default;
  if (options.mode === "off") {
    return "";
  }
  if (options.mode === "default") {
    return defaultTagline;
  }
  const env = options.env ?? process.env;
  const override = env?.OPENCLAW_TAGLINE_INDEX;
  if (override !== undefined) {
    const parsed = Number.parseInt(override, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const allTaglines = getAllTaglines();
      const pool = allTaglines.length > 0 ? allTaglines : [defaultTagline];
      return pool[parsed % pool.length];
    }
  }
  const pool = activeTaglines(options);
  const rand = options.random ?? Math.random;
  const index = Math.floor(rand() * pool.length) % pool.length;
  return pool[index];
}

export { HOLIDAY_RULES };
