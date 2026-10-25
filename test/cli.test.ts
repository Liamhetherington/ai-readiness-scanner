import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { parseArgs, run } from "../src/cli.js";
import { createFixture } from "./helpers/fixture.js";

const argv = (...args: string[]) => ["node", "ai-readiness", ...args];

describe("parseArgs", () => {
  it("defaults to the current directory and terminal output", () => {
    expect(parseArgs(argv())).toEqual({ repoPath: ".", format: "terminal", llm: false });
  });

  it("reads path, format, out and llm", () => {
    expect(parseArgs(argv("./repo", "--format", "md", "--out", "report.md", "--llm"))).toEqual({
      repoPath: "./repo",
      format: "md",
      out: "report.md",
      llm: true,
    });
  });

  it("rejects an unknown format", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(() => parseArgs(argv(".", "--format", "html"))).toThrow();
    stderr.mockRestore();
  });
});

describe("run", () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>;
  let stdout: string;
  let stderr: string;

  beforeAll(async () => {
    fixture = await createFixture({
      ".gitignore": "*.log\n",
      "README.md": "# Demo",
      "src/index.ts": "export {};",
      "debug.log": "ignored",
    });
  });

  afterAll(() => fixture.cleanup());

  const capture = () => {
    stdout = "";
    stderr = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });
    vi.spyOn(console, "error").mockImplementation((msg) => {
      stderr += `${msg}\n`;
    });
  };

  afterEach(() => vi.restoreAllMocks());

  it("prints the terminal report by default", async () => {
    capture();
    expect(await run(argv(fixture.root))).toBe(0);
    expect(stdout).toMatch(/Score {2}\d+\/100/);
    expect(stdout).toContain("Scanned 3 files");
    expect(stdout).toContain("Top fixes");
  });

  it("prints parseable JSON with --format json", async () => {
    capture();
    expect(await run(argv(fixture.root, "--format", "json"))).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.repo.fileCount).toBe(3);
    expect(report.checks.length).toBeGreaterThan(10);
  });

  it("prints markdown with --format md", async () => {
    capture();
    expect(await run(argv(fixture.root, "--format", "md"))).toBe(0);
    expect(stdout).toMatch(/^# AI readiness report: /);
    expect(stdout).toContain("## All checks");
  });

  it("writes to --out, creating folders, and prints a confirmation to stderr only", async () => {
    capture();
    const out = path.join(fixture.root, "reports", "nested", "report.md");
    expect(await run(argv(fixture.root, "--format", "md", "--out", out))).toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toMatch(/^Wrote md report to .*report\.md \(score \d+\/100\)/);
    expect(await readFile(out, "utf8")).toMatch(/^# AI readiness report: /);
  });

  it("never writes colour codes to a file", async () => {
    capture();
    vi.stubEnv("FORCE_COLOR", "1");
    const out = path.join(fixture.root, "reports", "terminal.txt");
    await run(argv(fixture.root, "--out", out));
    vi.unstubAllEnvs();
    expect(await readFile(out, "utf8")).not.toMatch(/\x1b\[/);
  });

  it("fails with exit code 1 when --out cannot be written", async () => {
    capture();
    // The fixture root is a directory, so it can't be overwritten with a file.
    expect(await run(argv(fixture.root, "--out", fixture.root))).toBe(1);
    expect(stderr).toMatch(/^error: could not write /);
  });

  it("fails with exit code 1 for a missing directory", async () => {
    capture();
    expect(await run(argv("/definitely/not/here"))).toBe(1);
    expect(stderr).toBe("error: not a directory: /definitely/not/here\n");
  });
});
