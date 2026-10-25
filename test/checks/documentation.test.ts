import { describe, expect, it } from "vitest";
import {
  decisionRecords,
  docsFolder,
  readmeExists,
  readmeLength,
  readmeSections,
} from "../../src/checks/documentation.js";
import { runCheck } from "../helpers/context.js";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("docs-readme", () => {
  it.each(["README.md", "readme.md", "README.rst", "README"])("finds %s", async (file) => {
    expect((await runCheck(readmeExists, { [file]: "x" })).passed).toBe(true);
  });

  it("ignores READMEs below the root", async () => {
    expect((await runCheck(readmeExists, { "docs/README.md": "x" })).earned).toBe(0);
  });
});

describe("docs-readme-length", () => {
  it.each([
    [350, 4],
    [300, 4],
    [150, 2],
    [50, 0],
  ])("%i words earn %i", async (n, earned) => {
    expect((await runCheck(readmeLength, { "README.md": words(n) })).earned).toBe(earned);
  });
});

describe("docs-readme-sections", () => {
  it("passes when headings cover setup, running and testing", async () => {
    const r = await runCheck(readmeSections, { "README.md": "# App\n## Installation\n## Usage\n## Running tests\n" });
    expect(r.passed).toBe(true);
  });

  it("accepts commands in place of headings", async () => {
    const r = await runCheck(readmeSections, { "README.md": "Run `npm install`, then `npm start`, then `npm test`." });
    expect(r.passed).toBe(true);
  });

  it("reads reStructuredText headings", async () => {
    const r = await runCheck(readmeSections, { "README.rst": "Getting started\n===============\n\nUsage\n-----\n" });
    expect(r.earned).toBe(4);
    expect(r.finding).toContain("test");
  });

  it("names the missing topics", async () => {
    const r = await runCheck(readmeSections, { "README.md": "# App\n\nThe latest contest results.\n" });
    expect(r.earned).toBe(0);
    expect(r.finding).toBe("README.md does not cover: setup, run, test.");
  });
});

describe("docs-folder", () => {
  it("passes with docs in docs/ or doc/", async () => {
    expect((await runCheck(docsFolder, { "docs/guide.md": "" })).passed).toBe(true);
    expect((await runCheck(docsFolder, { "doc/index.rst": "" })).passed).toBe(true);
  });

  it("fails when docs/ holds no written documents", async () => {
    expect((await runCheck(docsFolder, { "docs/logo.png": "" })).earned).toBe(0);
  });
});

describe("docs-adr", () => {
  it.each(["docs/adr/0001-x.md", "doc/adrs/1.md", "docs/decisions/use-x.md", "adr/0001.md"])("passes with %s", async (file) => {
    expect((await runCheck(decisionRecords, { [file]: "" })).passed).toBe(true);
  });

  it("finds ADRs in nested packages but not in fixtures or vendored code", async () => {
    expect((await runCheck(decisionRecords, { "packages/api/docs/adr/1.md": "" })).passed).toBe(true);
    const r = await runCheck(decisionRecords, { "test/fixtures/repo/docs/adr/1.md": "", "vendor/lib/docs/adr/1.md": "" });
    expect(r.earned).toBe(0);
  });

  it("gives partial credit for an ARCHITECTURE.md only", async () => {
    expect((await runCheck(decisionRecords, { "ARCHITECTURE.md": "" })).earned).toBe(2);
  });

  it("fails without either", async () => {
    expect((await runCheck(decisionRecords, { "README.md": "" })).earned).toBe(0);
  });
});
