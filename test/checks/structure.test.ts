import { describe, expect, it } from "vitest";
import { averageFileLength, folderNesting, largeFiles } from "../../src/checks/structure.js";
import { lines, runCheck } from "../helpers/context.js";

const smallFiles = (n: number, length = 50) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`src/m${i}.py`, lines(length)]));

describe("structure-large-files", () => {
  it("passes with no file over 500 lines (500 itself is fine)", async () => {
    const r = await runCheck(largeFiles, { ...smallFiles(3), "src/big.py": lines(500) });
    expect(r.passed).toBe(true);
  });

  it.each([
    [1, 99, 5],
    [1, 19, 3],
    [1, 9, 1],
    [1, 2, 0],
  ])("%i large file among %i small earns %i", async (large, small, earned) => {
    const files = { ...smallFiles(small) };
    for (let i = 0; i < large; i++) files[`src/big${i}.py`] = lines(501);
    expect((await runCheck(largeFiles, files)).earned).toBe(earned);
  });

  it("lists the largest files first", async () => {
    const r = await runCheck(largeFiles, { "a.ts": lines(600), "b.ts": lines(900), "c.ts": lines(10) });
    expect(r.finding).toBe("2 of 3 source files are over 500 lines, the largest being b.ts (900), a.ts (600).");
  });

  it("ignores test files and generated code", async () => {
    const r = await runCheck(largeFiles, {
      "src/a.ts": lines(10),
      "src/a.test.ts": lines(2000),
      "dist/types.d.ts": lines(2000),
      "src/generated/api.ts": lines(2000),
    });
    expect(r.passed).toBe(true);
  });
});

describe("structure-average-length", () => {
  it.each([
    [150, 6],
    [250, 4],
    [350, 2],
    [450, 0],
  ])("an average of %i lines earns %i", async (length, earned) => {
    const r = await runCheck(averageFileLength, smallFiles(4, length));
    expect(r.earned).toBe(earned);
    expect(r.finding).toBe(`Source files average ${length} lines.`);
  });
});

describe("structure-nesting", () => {
  it("passes at six folders deep", async () => {
    const r = await runCheck(folderNesting, { "a/b/c/d/e/f/x.ts": "", "src/y.ts": "" });
    expect(r.passed).toBe(true);
    expect(r.finding).toBe("Source folders nest at most 6 levels deep.");
  });

  it("gives partial credit when a few files are too deep", async () => {
    const files: Record<string, string> = { ...smallFiles(10), "a/b/c/d/e/f/g/x.ts": "" };
    expect((await runCheck(folderNesting, files)).earned).toBe(3);
  });

  it("fails when many files are too deep", async () => {
    const r = await runCheck(folderNesting, { "a/b/c/d/e/f/g/x.ts": "", "src/y.ts": "" });
    expect(r.earned).toBe(0);
    expect(r.finding).toContain("max 7");
  });
});

describe("structure checks with no source", () => {
  it.each([largeFiles, averageFileLength, folderNesting])("$id earns nothing", async (check) => {
    expect((await runCheck(check, { "README.md": "" })).earned).toBe(0);
  });
});
