import type { ScanContext } from "./context.js";

export type Category = "agent-context" | "testing" | "types-linting" | "documentation" | "structure";

export const CATEGORIES: { id: Category; label: string; points: number }[] = [
  { id: "agent-context", label: "Agent context", points: 20 },
  { id: "testing", label: "Testing", points: 25 },
  { id: "types-linting", label: "Type safety and linting", points: 15 },
  { id: "documentation", label: "Documentation", points: 20 },
  { id: "structure", label: "Code structure", points: 20 },
];

export interface CheckResult {
  id: string;
  /** Short human-readable name for reports. */
  title: string;
  category: Category;
  passed: boolean;
  pointsEarned: number;
  pointsPossible: number;
  /** One sentence describing what was found. */
  finding: string;
  /** One sentence describing how to improve (or keep) the result. */
  fix: string;
}

/** What a check's `run` returns; scoring fills in the rest of the CheckResult. */
export interface CheckOutcome {
  earned: number;
  finding: string;
  fix: string;
}

export interface Check {
  id: string;
  title: string;
  category: Category;
  points: number;
  run(ctx: ScanContext): Promise<CheckOutcome>;
}
