import type { Check } from "../types.js";
import { agentContextChecks } from "./agent-context.js";
import { documentationChecks } from "./documentation.js";
import { structureChecks } from "./structure.js";
import { testingChecks } from "./testing.js";
import { typesLintingChecks } from "./types-linting.js";

export const ALL_CHECKS: Check[] = [
  ...agentContextChecks,
  ...testingChecks,
  ...typesLintingChecks,
  ...documentationChecks,
  ...structureChecks,
];
