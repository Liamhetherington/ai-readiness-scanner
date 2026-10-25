import { createContext } from "./context.js";
import { runChecks, summarize, type ScoreResult } from "./scoring.js";
import type { AiSummary } from "./types.js";
import { walkRepo } from "./walker.js";

export interface ScanResult extends ScoreResult {
  root: string;
  fileCount: number;
  durationMs: number;
  aiSummary?: AiSummary;
}

export async function scan(repoPath: string): Promise<ScanResult> {
  const started = performance.now();
  const { root, files } = await walkRepo(repoPath);
  const ctx = createContext(root, files);
  const score = summarize(await runChecks(ctx));
  return { root, fileCount: files.length, durationMs: Math.round(performance.now() - started), ...score };
}
