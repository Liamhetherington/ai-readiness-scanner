import path from "node:path";
import { describe, expect, it } from "vitest";
import { scan } from "../src/scan.js";

const fixture = (name: string) => path.join(import.meta.dirname, "fixtures", name);

describe("fixture repos", () => {
  it("scores well-prepared above 80", async () => {
    const r = await scan(fixture("well-prepared"));
    expect(r.score).toBeGreaterThan(80);
  });

  it("scores average between 30 and 80", async () => {
    const r = await scan(fixture("average"));
    expect(r.score).toBeGreaterThanOrEqual(30);
    expect(r.score).toBeLessThanOrEqual(80);
  });

  it("scores poor below 30", async () => {
    const r = await scan(fixture("poor"));
    expect(r.score).toBeLessThan(30);
  });

  it("orders the fixtures well-prepared > average > poor in every category", async () => {
    const [good, mid, bad] = await Promise.all(["well-prepared", "average", "poor"].map((n) => scan(fixture(n))));
    for (const [i, cat] of good!.categories.entries()) {
      expect(cat.pointsEarned, cat.label).toBeGreaterThanOrEqual(mid!.categories[i]!.pointsEarned);
      expect(mid!.categories[i]!.pointsEarned, cat.label).toBeGreaterThanOrEqual(bad!.categories[i]!.pointsEarned);
    }
  });
});
