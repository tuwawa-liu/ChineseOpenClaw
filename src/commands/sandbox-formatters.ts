/**
 * Formatting utilities for sandbox CLI output
 */

import { t } from "../i18n/index.js";

export function formatStatus(running: boolean): string {
  return running ? t("commands.sandboxFormatters.runningIcon") : t("commands.sandboxFormatters.stoppedIcon");
}

export function formatSimpleStatus(running: boolean): string {
  return running ? t("commands.sandboxFormatters.running") : t("commands.sandboxFormatters.stopped");
}

export function formatImageMatch(matches: boolean): string {
  return matches ? t("commands.sandboxFormatters.match") : t("commands.sandboxFormatters.mismatch");
}

/**
 * Type guard and counter utilities
 */

export type ContainerItem = {
  running: boolean;
  imageMatch: boolean;
  containerName: string;
  sessionKey: string;
  image: string;
  createdAtMs: number;
  lastUsedAtMs: number;
};

export function countRunning<T extends { running: boolean }>(items: T[]): number {
  return items.filter((item) => item.running).length;
}

export function countMismatches<T extends { imageMatch: boolean }>(items: T[]): number {
  return items.filter((item) => !item.imageMatch).length;
}
