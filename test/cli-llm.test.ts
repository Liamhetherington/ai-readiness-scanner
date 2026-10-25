import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../src/cli.js";
import * as llm from "../src/llm/summary.js";

// Tests never call the real API: summarize is replaced for every test.
vi.mock("../src/llm/summary.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/llm/summary.js")>()),
  summarize: vi.fn(),
}));

const fixture = new URL("./fixtures/average", import.meta.url).pathname;
const argv = (...args: string[]) => ["node", "ai-readiness", fixture, ...args];

describe("run --llm", () => {
  let stdout: string;
  let stderr: string;

  beforeEach(() => {
    stdout = "";
    stderr = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });
    vi.spyOn(console, "error").mockImplementation((msg) => {
      stderr += `${msg}\n`;
    });
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.mocked(llm.summarize).mockReset();
  });

  it("explains a missing key, never calls the API, and still prints the full report", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await run(argv("--llm", "--format", "md"))).toBe(0);
    expect(stderr).toContain("warning: --llm needs an Anthropic API key. Set ANTHROPIC_API_KEY");
    expect(llm.summarize).not.toHaveBeenCalled();
    expect(stdout).toContain("## All checks");
    expect(stdout).not.toContain("## AI summary");
  });

  it("adds the summary to the report when the call succeeds", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.mocked(llm.summarize).mockResolvedValue({
      model: "claude-opus-5-5",
      summary: "Mocked summary of the average fixture.",
      priorities: ["One.", "Two.", "Three."],
    });
    expect(await run(argv("--llm", "--format", "json"))).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.aiSummary.summary).toBe("Mocked summary of the average fixture.");
    expect(report.score).toBe(42);
  });

  it("reports an API failure as a warning and still prints the full report", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.mocked(llm.summarize).mockRejectedValue(new llm.LlmSummaryError("the API key was rejected. Check ANTHROPIC_API_KEY."));
    expect(await run(argv("--llm"))).toBe(0);
    expect(stderr).toContain("warning: AI summary unavailable: the API key was rejected.");
    expect(stdout).toContain("Score  42/100");
  });

  it("does not load the SDK or ask for a summary without --llm", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(await run(argv())).toBe(0);
    expect(llm.summarize).not.toHaveBeenCalled();
    expect(stderr).toBe("");
  });
});
