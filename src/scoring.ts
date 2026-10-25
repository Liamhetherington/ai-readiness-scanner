import { ALL_CHECKS } from "./checks/index.js";
import type { ScanContext } from "./context.js";
import { CATEGORIES, type Category, type Check, type CheckResult } from "./types.js";

export interface CategoryScore {
  category: Category;
  label: string;
  pointsEarned: number;
  pointsPossible: number;
}

export interface ScoreResult {
  score: number;
  maxScore: number;
  categories: CategoryScore[];
  checks: CheckResult[];
}

export async function runChecks(ctx: ScanContext, checks: Check[] = ALL_CHECKS): Promise<CheckResult[]> {
  return Promise.all(
    checks.map(async (check) => {
      const outcome = await check.run(ctx);
      const earned = Math.max(0, Math.min(check.points, outcome.earned));
      return {
        id: check.id,
        title: check.title,
        category: check.category,
        passed: earned === check.points,
        pointsEarned: earned,
        pointsPossible: check.points,
        finding: outcome.finding,
        fix: outcome.fix,
      };
    }),
  );
}

export function summarize(checks: CheckResult[]): ScoreResult {
  const categories = CATEGORIES.map(({ id, label }) => {
    const inCategory = checks.filter((c) => c.category === id);
    return {
      category: id,
      label,
      pointsEarned: inCategory.reduce((sum, c) => sum + c.pointsEarned, 0),
      pointsPossible: inCategory.reduce((sum, c) => sum + c.pointsPossible, 0),
    };
  });
  return {
    score: categories.reduce((sum, c) => sum + c.pointsEarned, 0),
    maxScore: categories.reduce((sum, c) => sum + c.pointsPossible, 0),
    categories,
    checks,
  };
}

export interface FixSuggestion {
  fix: string;
  pointsGained: number;
  checkIds: string[];
}

/**
 * Fixes for failed checks, ordered by points gained. Checks that share the same
 * fix sentence are merged, since one action resolves them all.
 */
export function topFixes(checks: CheckResult[], limit = 5): FixSuggestion[] {
  const byFix = new Map<string, FixSuggestion>();
  for (const check of checks) {
    if (check.passed) continue;
    const entry = byFix.get(check.fix) ?? { fix: check.fix, pointsGained: 0, checkIds: [] };
    entry.pointsGained += check.pointsPossible - check.pointsEarned;
    entry.checkIds.push(check.id);
    byFix.set(check.fix, entry);
  }
  return [...byFix.values()].sort((a, b) => b.pointsGained - a.pointsGained).slice(0, limit);
}
