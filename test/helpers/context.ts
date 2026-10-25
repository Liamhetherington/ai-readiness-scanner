import { createContext, type ScanContext } from "../../src/context.js";
import type { Check } from "../../src/types.js";

/** A scan context backed by an in-memory file map. */
export function contextFromFiles(files: Record<string, string>): ScanContext {
  return createContext("/repo", Object.keys(files).sort(), async (f) => files[f]);
}

/** Runs one check against an in-memory repo. */
export async function runCheck(check: Check, files: Record<string, string>) {
  const outcome = await check.run(contextFromFiles(files));
  return { ...outcome, passed: outcome.earned === check.points };
}

/** Text with exactly `n` lines. */
export const lines = (n: number, line = "x = 1") => Array.from({ length: n }, () => line).join("\n");
