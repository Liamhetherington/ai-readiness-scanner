import { describe, expect, it } from "vitest";
import { ALL_CHECKS } from "../src/checks/index.js";
import { runChecks, summarize, topFixes } from "../src/scoring.js";
import { CATEGORIES, type CheckResult } from "../src/types.js";
import { contextFromFiles } from "./helpers/context.js";

describe("check registry", () => {
  it("adds up to 100 points", () => {
    expect(ALL_CHECKS.reduce((sum, c) => sum + c.points, 0)).toBe(100);
  });

  it.each(CATEGORIES)("gives $label exactly $points points", ({ id, points }) => {
    const total = ALL_CHECKS.filter((c) => c.category === id).reduce((sum, c) => sum + c.points, 0);
    expect(total).toBe(points);
  });

  it("has unique check ids", () => {
    expect(new Set(ALL_CHECKS.map((c) => c.id)).size).toBe(ALL_CHECKS.length);
  });
});

describe("runChecks", () => {
  it("returns every field for every check, with one-sentence findings and fixes", async () => {
    const results = await runChecks(contextFromFiles({ "src/a.ts": "export {};" }));
    expect(results).toHaveLength(ALL_CHECKS.length);
    for (const r of results) {
      expect(Object.keys(r).sort()).toEqual(
        ["category", "finding", "fix", "id", "passed", "pointsEarned", "pointsPossible", "title"].sort(),
      );
      expect(r.finding).toMatch(/\.$/);
      expect(r.fix).toMatch(/^[A-Z].*\.$/);
      expect(r.passed).toBe(r.pointsEarned === r.pointsPossible);
    }
  });

  it("clamps out-of-range outcomes", async () => {
    const [r] = await runChecks(contextFromFiles({}), [
      { id: "x", title: "X", category: "testing", points: 3, run: async () => ({ earned: 9, finding: "f.", fix: "F." }) },
    ]);
    expect(r?.pointsEarned).toBe(3);
  });
});

const result = (id: string, earned: number, possible: number, fix = `Fix ${id}.`): CheckResult => ({
  id,
  title: id,
  category: "testing",
  passed: earned === possible,
  pointsEarned: earned,
  pointsPossible: possible,
  finding: "f.",
  fix,
});

describe("summarize", () => {
  it("totals points per category and overall", () => {
    const s = summarize([result("a", 2, 6), { ...result("b", 5, 5), category: "structure" }]);
    expect(s.score).toBe(7);
    expect(s.maxScore).toBe(11);
    expect(s.categories.find((c) => c.category === "testing")).toMatchObject({ pointsEarned: 2, pointsPossible: 6 });
  });
});

describe("topFixes", () => {
  it("ranks failed checks by points gained and skips passed ones", () => {
    const fixes = topFixes([result("a", 0, 3), result("b", 1, 8), result("c", 5, 5)]);
    expect(fixes.map((f) => f.checkIds)).toEqual([["b"], ["a"]]);
    expect(fixes[0]?.pointsGained).toBe(7);
  });

  it("merges checks that share a fix", () => {
    const fixes = topFixes([result("a", 0, 10, "Same."), result("b", 0, 10, "Same."), result("c", 0, 15)]);
    expect(fixes[0]).toEqual({ fix: "Same.", pointsGained: 20, checkIds: ["a", "b"] });
  });

  it("returns at most five by default", () => {
    const many = Array.from({ length: 8 }, (_, i) => result(`c${i}`, 0, i + 1));
    expect(topFixes(many)).toHaveLength(5);
  });
});
