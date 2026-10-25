import type { ScanContext } from "../context.js";
import type { Check } from "../types.js";

export const CONTEXT_FILES = ["CLAUDE.md", "AGENTS.md", ".cursorrules", ".github/copilot-instructions.md"];
export const MIN_CONTEXT_CHARS = 200;
const ADD_CONTEXT_FILE =
  "Add an AGENTS.md or CLAUDE.md at the repo root that explains the layout, the build and test commands, and the coding conventions.";

const presentContextFiles = (ctx: ScanContext) => CONTEXT_FILES.filter((f) => ctx.has(f));

export const contextFilePresent: Check = {
  id: "agent-context-file",
  title: "Agent context file present",
  category: "agent-context",
  points: 10,
  async run(ctx) {
    const found = presentContextFiles(ctx);
    if (found.length > 0) {
      return {
        earned: this.points,
        finding: `Found agent context file${found.length > 1 ? "s" : ""}: ${found.join(", ")}.`,
        fix: "Keep the context file current whenever build steps or conventions change.",
      };
    }
    return {
      earned: 0,
      finding: "No agent context file (CLAUDE.md, AGENTS.md, .cursorrules or .github/copilot-instructions.md) found.",
      fix: ADD_CONTEXT_FILE,
    };
  },
};

export const contextFileMeaningful: Check = {
  id: "agent-context-content",
  title: "Agent context has meaningful content",
  category: "agent-context",
  points: 10,
  async run(ctx) {
    const found = presentContextFiles(ctx);
    if (found.length === 0) {
      return {
        earned: 0,
        finding: "There is no agent context file to evaluate.",
        fix: ADD_CONTEXT_FILE,
      };
    }
    const sizes = await Promise.all(
      found.map(async (file) => ({ file, chars: (await ctx.read(file))?.trim().length ?? 0 })),
    );
    const best = sizes.reduce((a, b) => (b.chars > a.chars ? b : a));
    if (best.chars > MIN_CONTEXT_CHARS) {
      return {
        earned: this.points,
        finding: `${best.file} has ${best.chars} characters of guidance.`,
        fix: "Review it periodically so agents are not following outdated instructions.",
      };
    }
    return {
      earned: 0,
      finding: `${best.file} has only ${best.chars} characters, too little to guide an agent.`,
      fix: `Expand ${best.file} with build and test commands, an architecture overview and the project's code conventions.`,
    };
  },
};

export const agentContextChecks = [contextFilePresent, contextFileMeaningful];
