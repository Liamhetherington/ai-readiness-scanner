import type { ScanResult } from "../scan.js";
import { topFixes, type CategoryScore, type FixSuggestion } from "../scoring.js";
import type { CheckResult } from "../types.js";
import { rating, repoName, type ReportOptions } from "./shared.js";

/** Bump when a field is removed or changes meaning, so CI consumers can detect it. */
export const JSON_SCHEMA_VERSION = 1;

export interface JsonReport {
  schemaVersion: number;
  tool: { name: "ai-readiness"; version: string };
  repo: { name: string; root: string; fileCount: number };
  durationMs: number;
  score: number;
  maxScore: number;
  rating: string;
  categories: CategoryScore[];
  topFixes: FixSuggestion[];
  checks: CheckResult[];
}

export function toJsonReport(result: ScanResult, options: ReportOptions): JsonReport {
  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    tool: { name: "ai-readiness", version: options.version },
    repo: { name: repoName(result), root: result.root, fileCount: result.fileCount },
    durationMs: result.durationMs,
    score: result.score,
    maxScore: result.maxScore,
    rating: rating(result),
    categories: result.categories,
    topFixes: topFixes(result.checks),
    checks: result.checks,
  };
}

export function renderJson(result: ScanResult, options: ReportOptions): string {
  return `${JSON.stringify(toJsonReport(result, options), null, 2)}\n`;
}
