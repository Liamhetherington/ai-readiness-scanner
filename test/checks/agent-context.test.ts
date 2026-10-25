import { describe, expect, it } from "vitest";
import { contextFileMeaningful, contextFilePresent } from "../../src/checks/agent-context.js";
import { runCheck } from "../helpers/context.js";

const long = "Build with npm run build. ".repeat(10);

describe("agent-context-file", () => {
  it.each(["CLAUDE.md", "AGENTS.md", ".cursorrules", ".github/copilot-instructions.md"])("passes with %s", async (file) => {
    const r = await runCheck(contextFilePresent, { [file]: "x" });
    expect(r.passed).toBe(true);
    expect(r.finding).toContain(file);
  });

  it("fails without any context file", async () => {
    const r = await runCheck(contextFilePresent, { "README.md": "x", "docs/CLAUDE.md": "nested does not count" });
    expect(r.earned).toBe(0);
    expect(r.fix).toMatch(/AGENTS\.md or CLAUDE\.md/);
  });
});

describe("agent-context-content", () => {
  it("passes when a context file has over 200 characters", async () => {
    const r = await runCheck(contextFileMeaningful, { "CLAUDE.md": long });
    expect(r.passed).toBe(true);
  });

  it("fails at exactly 200 characters (must be over)", async () => {
    const r = await runCheck(contextFileMeaningful, { "CLAUDE.md": "a".repeat(200) });
    expect(r.earned).toBe(0);
    expect(r.finding).toContain("200 characters");
  });

  it("ignores surrounding whitespace when measuring", async () => {
    const r = await runCheck(contextFileMeaningful, { "AGENTS.md": `   ${"a".repeat(150)}   \n\n\n${" ".repeat(100)}` });
    expect(r.earned).toBe(0);
  });

  it("uses the longest file when there are several", async () => {
    const r = await runCheck(contextFileMeaningful, { "AGENTS.md": "see CLAUDE.md", "CLAUDE.md": long });
    expect(r.passed).toBe(true);
    expect(r.finding).toMatch(/^CLAUDE\.md/);
  });

  it("fails with the same fix as the presence check when no file exists", async () => {
    const r = await runCheck(contextFileMeaningful, {});
    const presence = await runCheck(contextFilePresent, {});
    expect(r.earned).toBe(0);
    expect(r.fix).toBe(presence.fix);
  });
});
