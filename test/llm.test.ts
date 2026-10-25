import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildPayload,
  buildRequest,
  hasApiKey,
  LlmSummaryError,
  parseSummary,
  summarize,
  SUMMARY_MODEL,
  type SummaryClient,
} from "../src/llm/summary.js";
import { scan } from "../src/scan.js";
import { walkRepo } from "../src/walker.js";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;

const FIXTURES = path.join(import.meta.dirname, "fixtures");

const message = (text: string, overrides: Partial<BetaMessage> = {}): BetaMessage =>
  ({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: SUMMARY_MODEL,
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    ...overrides,
  }) as unknown as BetaMessage;

const goodReply = JSON.stringify({
  summary: "  The repository scores 42/100. Agents lack context.  ",
  priorities: ["Add an AGENTS.md.", " Split handlers.py. ", "Add mypy.", "A fourth one.", ""],
});

const fakeClient = (create: SummaryClient["beta"]["messages"]["create"]): SummaryClient => ({
  beta: { messages: { create } },
});

describe("buildPayload: no source code ever leaves the machine", () => {
  it.each(["well-prepared", "average", "poor"])("contains no line of any file in the %s fixture", async (name) => {
    const root = path.join(FIXTURES, name);
    const payload = JSON.stringify(buildRequest(await scan(root)));
    const { files } = await walkRepo(root);
    let checked = 0;
    for (const file of files) {
      const text = await readFile(path.join(root, file), "utf8");
      // Lines short enough to be generic ("}", "## Usage") could appear by coincidence.
      for (const line of text.split("\n").map((l) => l.trim()).filter((l) => l.length >= 25)) {
        expect(payload, `${file}: ${line}`).not.toContain(line);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("never includes the absolute repo path", async () => {
    const root = path.join(FIXTURES, "average");
    const payload = JSON.stringify(buildRequest(await scan(root)));
    expect(payload).not.toContain(root);
    expect(payload).not.toContain(import.meta.dirname);
  });

  it("sends only scores and check outcomes", async () => {
    const payload = buildPayload(await scan(path.join(FIXTURES, "average")));
    expect(Object.keys(payload).sort()).toEqual(["categories", "checks", "fileCount", "maxScore", "repo", "score", "topFixes"]);
    expect(payload.repo).toBe("average");
    expect(Object.keys(payload.checks[0]!).sort()).toEqual(
      ["category", "finding", "fix", "id", "passed", "pointsEarned", "pointsPossible", "title"],
    );
  });
});

describe("buildRequest", () => {
  it("asks the default model for structured JSON with a server-side refusal fallback", async () => {
    const request = buildRequest(await scan(path.join(FIXTURES, "poor")));
    expect(request.model).toBe("claude-opus-5-5");
    expect(request.fallbacks).toBe("default");
    expect(request.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(request.output_config?.format?.type).toBe("json_schema");
    expect(request.output_config?.effort).toBe("medium");
    expect(request.system).toContain("about 150 words");
    expect(request.system).toContain("exactly 3");
    expect(request.messages).toHaveLength(1);
    expect(request.messages[0]?.content).toMatch(/^Scan results:\n\{/);
  });
});

describe("parseSummary", () => {
  it("returns the summary, trimmed, with at most three non-empty priorities", () => {
    expect(parseSummary(message(goodReply))).toEqual({
      model: SUMMARY_MODEL,
      summary: "The repository scores 42/100. Agents lack context.",
      priorities: ["Add an AGENTS.md.", "Split handlers.py.", "Add mypy."],
    });
  });

  it("reports the model that actually answered, which differs after a fallback", () => {
    expect(parseSummary(message(goodReply, { model: "claude-opus-5" })).model).toBe("claude-opus-5");
  });

  it.each([
    ["a refusal", message("", { stop_reason: "refusal" }), /declined/],
    ["a truncated reply", message('{"summary": "cut', { stop_reason: "max_tokens" }), /cut off/],
    ["invalid JSON", message("not json"), /not valid JSON/],
    ["a missing summary", message(JSON.stringify({ priorities: ["a"] })), /missing/],
    ["empty priorities", message(JSON.stringify({ summary: "s", priorities: ["", "  "] })), /missing/],
  ])("rejects %s with a readable reason", (_, msg, reason) => {
    expect(() => parseSummary(msg)).toThrow(LlmSummaryError);
    expect(() => parseSummary(msg)).toThrow(reason);
  });
});

describe("summarize", () => {
  it("sends the built request and parses the reply", async () => {
    const result = await scan(path.join(FIXTURES, "average"));
    const create = vi.fn(async () => message(goodReply));
    const summary = await summarize(result, fakeClient(create));
    expect(create).toHaveBeenCalledWith(buildRequest(result));
    expect(summary.priorities).toHaveLength(3);
  });

  it("turns API errors into readable reasons", async () => {
    const result = await scan(path.join(FIXTURES, "poor"));
    const failWith = (err: unknown) => summarize(result, fakeClient(async () => Promise.reject(err)));
    await expect(failWith(new Anthropic.APIConnectionError({ message: "offline" }))).rejects.toThrow(
      /could not reach the Anthropic API/,
    );
    await expect(failWith(new Anthropic.APIConnectionTimeoutError())).rejects.toThrow(/timed out/);
    await expect(failWith(new Error("boom"))).rejects.toThrow("unexpected error: boom");
  });
});

describe("hasApiKey", () => {
  it.each([
    [{ ANTHROPIC_API_KEY: "sk-ant-x" }, true],
    [{ ANTHROPIC_AUTH_TOKEN: "token" }, true],
    [{ ANTHROPIC_API_KEY: "  " }, false],
    [{}, false],
  ])("%j -> %s", (env, expected) => expect(hasApiKey(env)).toBe(expected));
});
