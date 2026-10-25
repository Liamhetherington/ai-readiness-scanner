import { describe, expect, it } from "vitest";
import { countLines } from "../src/context.js";
import { hasSection, mapLimit } from "../src/util/config.js";
import { parseJsonc } from "../src/util/jsonc.js";

describe("parseJsonc", () => {
  it("strips comments and trailing commas", () => {
    expect(parseJsonc('{\n  // c\n  "a": 1, /* b */\n  "b": [1, 2,],\n}')).toEqual({ a: 1, b: [1, 2] });
  });

  it("leaves comment-like text inside strings alone", () => {
    expect(parseJsonc('{ "include": ["src/**/*"], "url": "https://x" }')).toEqual({
      include: ["src/**/*"],
      url: "https://x",
    });
  });

  it("handles escaped quotes", () => {
    expect(parseJsonc('{ "a": "say \\"hi\\" // not a comment" }')).toEqual({ a: 'say "hi" // not a comment' });
  });
});

describe("hasSection", () => {
  const toml = '[project]\nname = "x"\n\n[tool.ruff.lint]\nselect = ["E"]\n';

  it("matches a table and its subtables", () => {
    expect(hasSection(toml, "tool.ruff")).toBe(true);
    expect(hasSection(toml, "project")).toBe(true);
  });

  it("does not match a prefix of a different table name", () => {
    expect(hasSection("[tool.ruffx]\n", "tool.ruff")).toBe(false);
    expect(hasSection(toml, "tool.mypy")).toBe(false);
  });

  it("handles INI sections with colons and missing content", () => {
    expect(hasSection("[tool:pytest]\naddopts = -q", "tool:pytest")).toBe(true);
    expect(hasSection(undefined, "x")).toBe(false);
  });
});

describe("countLines", () => {
  it("counts lines with or without a trailing newline", () => {
    expect(countLines("")).toBe(0);
    expect(countLines("a")).toBe(1);
    expect(countLines("a\nb")).toBe(2);
    expect(countLines("a\nb\n")).toBe(2);
  });
});

describe("mapLimit", () => {
  it("keeps order and never exceeds the limit", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return n * 10;
    });
    expect(result).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });
});
