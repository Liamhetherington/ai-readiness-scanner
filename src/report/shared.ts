import path from "node:path";
import type { ScanResult } from "../scan.js";

export interface ReportOptions {
  version: string;
}

export type Level = "good" | "fair" | "poor";

/** Thresholds shared by the overall score and each category, as a share of possible points. */
export function level(earned: number, possible: number): Level {
  const share = possible === 0 ? 0 : earned / possible;
  return share >= 0.8 ? "good" : share >= 0.5 ? "fair" : "poor";
}

export const RATING_LABELS: Record<Level, string> = {
  good: "Ready for AI agents",
  fair: "Partly ready",
  poor: "Not ready",
};

export function rating(result: ScanResult): string {
  return RATING_LABELS[level(result.score, result.maxScore)];
}

export const repoName = (result: ScanResult) => path.basename(result.root);

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
