import { formatDurationHuman as _formatDurationHuman } from "../../../src/infra/format-time/format-duration.ts";
import {
  formatRelativeTimestamp as _formatRelativeTimestamp,
  type FormatRelativeTimestampOptions,
  formatTimeAgo as _formatTimeAgo,
  type FormatTimeAgoOptions,
} from "../../../src/infra/format-time/format-relative.ts";
import { formatDurationSeconds as _formatDurationSeconds, type FormatDurationSecondsOptions } from "../../../src/infra/format-time/format-duration.ts";
import { stripAssistantInternalScaffolding } from "../../../src/shared/text/assistant-visible-text.js";
import { t } from "../i18n/index.ts";

/**
 * i18n-aware wrappers around shared time formatting functions.
 * These replace the raw English strings with translated versions.
 */

function localizeRelativeTime(raw: string): string {
  if (raw === "unknown") return t("timeRelative.unknown");
  if (raw === "just now") return t("timeRelative.justNow");
  if (raw === "n/a") return t("presenterExtra.na");
  if (raw === "in <1m") return t("timeRelative.inLessThan1m");

  let m: RegExpMatchArray | null;
  m = raw.match(/^(\d+)m ago$/);
  if (m) return t("timeRelative.minutesAgo", { min: m[1] });
  m = raw.match(/^(\d+)h ago$/);
  if (m) return t("timeRelative.hoursAgo", { hr: m[1] });
  m = raw.match(/^(\d+)d ago$/);
  if (m) return t("timeRelative.daysAgo", { day: m[1] });
  m = raw.match(/^in (\d+)m$/);
  if (m) return t("timeRelative.inMinutes", { min: m[1] });
  m = raw.match(/^in (\d+)h$/);
  if (m) return t("timeRelative.inHours", { hr: m[1] });
  m = raw.match(/^in (\d+)d$/);
  if (m) return t("timeRelative.inDays", { day: m[1] });

  return raw;
}

function localizeDuration(raw: string): string {
  if (raw === "unknown") return t("timeDuration.unknown");
  const m = raw.match(/^(.+) seconds$/);
  if (m) return t("timeDuration.seconds", { value: m[1] });
  return raw;
}

export function formatRelativeTimestamp(
  timestampMs: number | null | undefined,
  options?: FormatRelativeTimestampOptions,
): string {
  return localizeRelativeTime(_formatRelativeTimestamp(timestampMs, options));
}

export function formatTimeAgo(
  durationMs: number | null | undefined,
  options?: FormatTimeAgoOptions,
): string {
  return localizeRelativeTime(_formatTimeAgo(durationMs, options));
}

export function formatDurationHuman(ms?: number | null, fallback?: string): string {
  return localizeDuration(_formatDurationHuman(ms, fallback));
}

export function formatDurationSeconds(
  ms: number,
  options?: FormatDurationSecondsOptions,
): string {
  return localizeDuration(_formatDurationSeconds(ms, options));
}

export function formatMs(ms?: number | null): string {
  if (!ms && ms !== 0) {
    return t("formatExtra.na");
  }
  return new Date(ms).toLocaleString();
}

export function formatList(values?: Array<string | null | undefined>): string {
  if (!values || values.length === 0) {
    return t("formatExtra.none");
  }
  return values.filter((v): v is string => Boolean(v && v.trim())).join(", ");
}

export function clampText(value: string, max = 120): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function truncateText(
  value: string,
  max: number,
): {
  text: string;
  truncated: boolean;
  total: number;
} {
  if (value.length <= max) {
    return { text: value, truncated: false, total: value.length };
  }
  return {
    text: value.slice(0, Math.max(0, max)),
    truncated: true,
    total: value.length,
  };
}

export function toNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseList(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function stripThinkingTags(value: string): string {
  return stripAssistantInternalScaffolding(value);
}

export function formatCost(cost: number | null | undefined, fallback = "$0.00"): string {
  if (cost == null || !Number.isFinite(cost)) {
    return fallback;
  }
  if (cost === 0) {
    return "$0.00";
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export function formatTokens(tokens: number | null | undefined, fallback = "0"): string {
  if (tokens == null || !Number.isFinite(tokens)) {
    return fallback;
  }
  if (tokens < 1000) {
    return String(Math.round(tokens));
  }
  if (tokens < 1_000_000) {
    const k = tokens / 1000;
    return k < 10 ? `${k.toFixed(1)}k` : `${Math.round(k)}k`;
  }
  const m = tokens / 1_000_000;
  return m < 10 ? `${m.toFixed(1)}M` : `${Math.round(m)}M`;
}

export function formatPercent(value: number | null | undefined, fallback = "—"): string {
  if (value == null || !Number.isFinite(value)) {
    return fallback;
  }
  return `${(value * 100).toFixed(1)}%`;
}
