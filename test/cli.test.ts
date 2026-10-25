import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

  beforeAll(async () => {
    fixture = await createFixture({
      ".gitignore": "*.log\n",
      "README.md": "# Demo",
      "src/index.ts": "export {};",
      "debug.log": "ignored",
    });
  });

  afterAll(() => fixture.cleanup());

  it("scans the repo and reports the file count", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await run(argv(fixture.root));
    expect(code).toBe(0);
    expect(log.mock.calls[0]?.[0]).toMatch(/^Scanned 3 files in /);
    log.mockRestore();
  });

  it("fails with exit code 1 for a missing directory", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await run(argv("/definitely/not/here"));
    expect(code).toBe(1);
    expect(error).toHaveBeenCalledWith("error: not a directory: /definitely/not/here");
    error.mockRestore();
  });
});
