import { describe, expect, it } from "vitest";
import { renderJson, toJsonReport, JSON_SCHEMA_VERSION } from "../src/report/json.js";
import { renderMarkdown } from "../src/report/markdown.js";
import { level, rating } from "../src/report/shared.js";
import { renderTerminal, shouldColor, wrap } from "../src/report/terminal.js";
import { checkResult, scanResult } from "./helpers/result.js";

const ANSI = /\x1b\[/;

const mixed = scanResult([
  checkResult({ id: "ctx", category: "agent-context", pointsEarned: 0, pointsPossible: 20, fix: "Add a CLAUDE.md." }),
  checkResult({ id: "tests", category: "testing", pointsEarned: 10, pointsPossible: 25, fix: "Write more tests." }),
  checkResult({ id: "lint", category: "types-linting", pointsEarned: 15, pointsPossible: 15 }),
  checkResult({ id: "readme", category: "documentation", pointsEarned: 20, pointsPossible: 20, finding: "README has a | pipe." }),
  checkResult({ id: "big", category: "structure", pointsEarned: 4, pointsPossible: 20, fix: "Split big files." }),
]);

const perfect = scanResult([checkResult({ id: "all", pointsEarned: 100, pointsPossible: 100 })]);

const sixFailures = scanResult(
  Array.from({ length: 6 }, (_, i) => checkResult({ id: `c${i}`, pointsEarned: 0, pointsPossible: 10 + i })),
);

describe("level and rating", () => {
  it.each([
    [80, 100, "good"],
    [79, 100, "fair"],
    [50, 100, "fair"],
    [49, 100, "poor"],
    [0, 0, "poor"],
  ])("%i/%i is %s", (earned, possible, expected) => expect(level(earned, possible)).toBe(expected));

  it("labels the overall score", () => {
    expect(rating(perfect)).toBe("Ready for AI agents");
    expect(rating(mixed)).toBe("Not ready");
    expect(rating(scanResult([checkResult({ id: "x", pointsEarned: 60, pointsPossible: 100 })]))).toBe("Partly ready");
  });
});

describe("renderTerminal", () => {
  const plain = renderTerminal(mixed, { version: "1.2.3", color: false });

  it("shows the overall score, rating and every category", () => {
    expect(plain).toContain("AI Readiness: demo-repo");
    expect(plain).toContain("Score  49/100  Not ready");
    for (const label of ["Agent context", "Testing", "Type safety and linting", "Documentation", "Code structure"]) {
      expect(plain).toMatch(new RegExp(`${label}\\s+[█░]{20}\\s+\\d+/\\d+`));
    }
  });

  it("lists failed checks as fixes ranked by points gained", () => {
    const fixes = plain.split("\n").filter((l) => /^\s*\d+\.\s+\+\d+/.test(l));
    expect(fixes).toEqual([" 1. +20  Add a CLAUDE.md.", " 2. +16  Split big files.", " 3. +15  Write more tests."]);
  });

  it("shows at most five fixes", () => {
    const out = renderTerminal(sixFailures, { version: "1", color: false });
    expect(out).toContain(" 5. ");
    expect(out).not.toContain(" 6. ");
  });

  it("says so when there is nothing to fix", () => {
    expect(renderTerminal(perfect, { version: "1", color: false })).toContain("Every check passed. Nothing to fix.");
  });

  it("adds colour only when asked", () => {
    expect(plain).not.toMatch(ANSI);
    expect(renderTerminal(mixed, { version: "1", color: true })).toMatch(ANSI);
  });

  it("wraps long fixes under a hanging indent", () => {
    const long = scanResult([checkResult({ id: "x", pointsPossible: 9, fix: "word ".repeat(40).trim() })]);
    const lines = renderTerminal(long, { version: "1", color: false, width: 60 }).split("\n");
    const start = lines.findIndex((l) => l.startsWith(" 1."));
    expect(lines[start]!.length).toBeLessThanOrEqual(60);
    expect(lines[start + 1]).toMatch(/^ {9}word/);
  });
});

describe("shouldColor", () => {
  it("follows the TTY by default", () => {
    expect(shouldColor({ isTTY: true }, {})).toBe(true);
    expect(shouldColor({ isTTY: false }, {})).toBe(false);
  });

  it("honours NO_COLOR over FORCE_COLOR, and FORCE_COLOR over the TTY", () => {
    expect(shouldColor({ isTTY: true }, { NO_COLOR: "1", FORCE_COLOR: "1" })).toBe(false);
    expect(shouldColor({ isTTY: false }, { FORCE_COLOR: "1" })).toBe(true);
    expect(shouldColor({ isTTY: false }, { FORCE_COLOR: "0" })).toBe(false);
  });
});

describe("wrap", () => {
  it("breaks on word boundaries within the width", () => {
    expect(wrap("aa bb cc dd", 5)).toEqual(["aa bb", "cc dd"]);
  });

  it("keeps a word longer than the width on its own line", () => {
    expect(wrap("a verylongword b", 4)).toEqual(["a", "verylongword", "b"]);
  });
});

describe("renderMarkdown", () => {
  const md = renderMarkdown(mixed, { version: "1.2.3" });

  it("has a title, score and category table", () => {
    expect(md).toMatch(/^# AI readiness report: demo-repo\n/);
    expect(md).toContain("**Score: 49/100**, Not ready 🔴");
    expect(md).toContain("| Agent context | 0/20 | 🔴 |");
    expect(md).toContain("| Type safety and linting | 15/15 | 🟢 |");
  });

  it("lists top fixes as a numbered list", () => {
    expect(md).toContain("1. **+20** Add a CLAUDE.md.\n2. **+16** Split big files.\n3. **+15** Write more tests.");
  });

  it("includes every check with status, finding and (for failures) fix", () => {
    expect(md).toContain("| ❌ | Title ctx | 0/20 | Finding ctx. | Add a CLAUDE.md. |");
    expect(md).toContain("| ⚠️ | Title tests | 10/25 | Finding tests. | Write more tests. |");
    expect(md).toContain("| ✅ | Title lint | 15/15 | Finding lint. |  |");
    for (const id of ["ctx", "tests", "lint", "readme", "big"]) expect(md).toContain(`Title ${id}`);
  });

  it("escapes pipes so table cells don't break", () => {
    expect(md).toContain("README has a \\| pipe.");
  });

  it("groups checks under category headings", () => {
    expect(md).toContain("### Testing (10/25)");
    expect(md).toContain("### Code structure (4/20)");
  });

  it("credits the tool version in the footer", () => {
    expect(md).toContain("Scanned 42 files in 12 ms with ai-readiness 1.2.3.");
  });
});

describe("renderJson", () => {
  it("is valid JSON with the full structured result", () => {
    const parsed = JSON.parse(renderJson(mixed, { version: "1.2.3" }));
    expect(parsed).toEqual(toJsonReport(mixed, { version: "1.2.3" }));
    expect(parsed).toMatchObject({
      schemaVersion: JSON_SCHEMA_VERSION,
      tool: { name: "ai-readiness", version: "1.2.3" },
      repo: { name: "demo-repo", root: "/work/demo-repo", fileCount: 42 },
      score: 49,
      maxScore: 100,
      rating: "Not ready",
    });
    expect(parsed.checks).toHaveLength(5);
    expect(parsed.categories).toHaveLength(5);
    expect(parsed.topFixes[0]).toEqual({ fix: "Add a CLAUDE.md.", pointsGained: 20, checkIds: ["ctx"] });
  });

  it("ends with a newline and has no colour codes", () => {
    const out = renderJson(mixed, { version: "1" });
    expect(out.endsWith("}\n")).toBe(true);
    expect(out).not.toMatch(ANSI);
  });
});

describe("AI summary in reports", () => {
  const withSummary = {
    ...mixed,
    aiSummary: {
      model: "claude-opus-5-5",
      summary: "The repo is partly ready. Context files are missing and tests are thin.",
      priorities: ["Add a CLAUDE.md.", "Write more tests.", "Split big files."],
    },
  };

  it("shows the summary and numbered priorities in the terminal", () => {
    const out = renderTerminal(withSummary, { version: "1", color: false });
    expect(out).toContain("AI summary (claude-opus-5-5)");
    expect(out).toContain("  The repo is partly ready.");
    expect(out).toMatch(/Priorities\n 1\. Add a CLAUDE\.md\.\n 2\. Write more tests\.\n 3\. Split big files\./);
    expect(out.indexOf("AI summary")).toBeLessThan(out.indexOf("Top fixes"));
  });

  it("adds an AI summary section to markdown, noting no source code was sent", () => {
    const md = renderMarkdown(withSummary, { version: "1" });
    expect(md).toContain("## AI summary\n\nThe repo is partly ready.");
    expect(md).toContain("**Priorities**\n\n1. Add a CLAUDE.md.\n2. Write more tests.\n3. Split big files.");
    expect(md).toContain("_Written by claude-opus-5-5 from the scan results above. No source code was sent._");
  });

  it("includes aiSummary in JSON, and null without --llm", () => {
    expect(JSON.parse(renderJson(withSummary, { version: "1" })).aiSummary).toEqual(withSummary.aiSummary);
    expect(JSON.parse(renderJson(mixed, { version: "1" })).aiSummary).toBeNull();
  });

  it("leaves reports unchanged without a summary", () => {
    expect(renderTerminal(mixed, { version: "1", color: false })).not.toContain("AI summary");
    expect(renderMarkdown(mixed, { version: "1" })).not.toContain("## AI summary");
  });
});
