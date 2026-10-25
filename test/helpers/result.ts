import type { ScanResult } from "../../src/scan.js";
import { summarize } from "../../src/scoring.js";
import type { Category, CheckResult } from "../../src/types.js";

export function checkResult(overrides: Partial<CheckResult> & Pick<CheckResult, "id">): CheckResult {
  const pointsPossible = overrides.pointsPossible ?? 5;
  const pointsEarned = overrides.pointsEarned ?? 0;
  return {
    title: `Title ${overrides.id}`,
    category: "testing" as Category,
    finding: `Finding ${overrides.id}.`,
    fix: `Fix ${overrides.id}.`,
    ...overrides,
    pointsPossible,
    pointsEarned,
    passed: pointsEarned === pointsPossible,
  };
}

/** A ScanResult built from check results, without scanning anything. */
export function scanResult(checks: CheckResult[]): ScanResult {
  return { root: "/work/demo-repo", fileCount: 42, durationMs: 12, ...summarize(checks) };
}
