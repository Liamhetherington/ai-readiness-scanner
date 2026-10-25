import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import type { ScanResult } from "../scan.js";
import { topFixes } from "../scoring.js";
import type { AiSummary } from "../types.js";

export const SUMMARY_MODEL = "claude-opus-5-5";
export const SUMMARY_WORDS = 150;
const PRIORITY_COUNT = 3;
const REQUEST_TIMEOUT_MS = 120_000;

/** The minimal client surface used here, so tests can pass a fake. */
export interface SummaryClient {
  beta: {
    messages: {
      create(params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Beta.Messages.BetaMessage>;
    };
  };
}

/** A failure the CLI reports as a one-line warning before printing the normal report. */
export class LlmSummaryError extends Error {}

export const MISSING_KEY_MESSAGE =
  "--llm needs an Anthropic API key. Set ANTHROPIC_API_KEY (create one at https://console.anthropic.com/settings/keys) " +
  "and run again, or drop --llm. The report below is complete without it.";

export function hasApiKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim());
}

/**
 * Everything sent to the model. Built field by field from scan results so that
 * no source code, file contents or local paths can reach the API: only check
 * outcomes, the one-sentence findings and fixes, and the repo's folder name.
 */
export function buildPayload(result: ScanResult) {
  return {
    repo: path.basename(result.root),
    fileCount: result.fileCount,
    score: result.score,
    maxScore: result.maxScore,
    categories: result.categories.map((c) => ({
      category: c.label,
      pointsEarned: c.pointsEarned,
      pointsPossible: c.pointsPossible,
    })),
    checks: result.checks.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      passed: c.passed,
      pointsEarned: c.pointsEarned,
      pointsPossible: c.pointsPossible,
      finding: c.finding,
      fix: c.fix,
    })),
    topFixes: topFixes(result.checks).map((f) => ({ fix: f.fix, pointsGained: f.pointsGained })),
  };
}

const SYSTEM_PROMPT = `You review results from ai-readiness, a tool that scores how well a software repository supports AI coding agents (out of 100, across agent context files, testing, type safety and linting, documentation, and code structure).

You receive the scan results as JSON: scores, and for each check whether it passed, a one-sentence finding and a one-sentence fix. You do not see the source code, so base every statement on these results and do not guess at anything they don't show.

Write for an engineering lead deciding what to do next:
- summary: about ${SUMMARY_WORDS} words of plain prose on where the repository stands and what is most likely to hold coding agents back. Mention the score once.
- priorities: exactly ${PRIORITY_COUNT} concrete actions, most impactful first, each a single imperative sentence tied to specific failing or partial checks. If fewer than ${PRIORITY_COUNT} checks fall short, use the remaining slots for ways to keep the strong areas strong.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    priorities: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "priorities"],
  additionalProperties: false,
};

export function buildRequest(result: ScanResult): Anthropic.Beta.Messages.MessageCreateParamsNonStreaming {
  return {
    model: SUMMARY_MODEL,
    max_tokens: 16000,
    // If a safety classifier declines, retry server-side on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Scan results:\n${JSON.stringify(buildPayload(result), null, 2)}` }],
  };
}

export function parseSummary(message: Anthropic.Beta.Messages.BetaMessage): AiSummary {
  if (message.stop_reason === "refusal") {
    throw new LlmSummaryError("the model declined to summarise these results.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new LlmSummaryError("the model's reply was cut off before it finished.");
  }
  const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LlmSummaryError("the model's reply was not valid JSON.");
  }
  const { summary, priorities } = (parsed ?? {}) as { summary?: unknown; priorities?: unknown };
  const cleanPriorities = Array.isArray(priorities)
    ? priorities.filter((p): p is string => typeof p === "string" && p.trim() !== "").map((p) => p.trim())
    : [];
  if (typeof summary !== "string" || summary.trim() === "" || cleanPriorities.length === 0) {
    throw new LlmSummaryError("the model's reply was missing the summary or priorities.");
  }
  // The served model can differ from the requested one when a fallback ran.
  return { model: message.model, summary: summary.trim(), priorities: cleanPriorities.slice(0, PRIORITY_COUNT) };
}

/** Asks Claude for a summary of the scan results. Throws LlmSummaryError with a user-facing reason. */
export async function summarize(result: ScanResult, client?: SummaryClient): Promise<AiSummary> {
  const api: SummaryClient = client ?? new Anthropic({ timeout: REQUEST_TIMEOUT_MS });
  let message: Anthropic.Beta.Messages.BetaMessage;
  try {
    message = await api.beta.messages.create(buildRequest(result));
  } catch (err) {
    throw new LlmSummaryError(describeApiError(err));
  }
  return parseSummary(message);
}

function describeApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "the API key was rejected. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.PermissionDeniedError) return "the API key is not allowed to use this model.";
  if (err instanceof Anthropic.RateLimitError) return "the Anthropic API rate limit was hit. Try again shortly.";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "the request to the Anthropic API timed out.";
  if (err instanceof Anthropic.APIConnectionError) return "could not reach the Anthropic API. Check your network connection.";
  if (err instanceof Anthropic.APIError) return `the Anthropic API returned an error (${err.status ?? "unknown status"}).`;
  return `unexpected error: ${(err as Error).message}`;
}
