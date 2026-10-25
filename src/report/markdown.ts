import type { ScanResult } from "../scan.js";
import { topFixes } from "../scoring.js";
import type { CheckResult } from "../types.js";
import { level, plural, rating, repoName, type Level, type ReportOptions } from "./shared.js";

const LEVEL_ICON: Record<Level, string> = { good: "🟢", fair: "🟡", poor: "🔴" };

function status(check: CheckResult): string {
  if (check.passed) return "✅";
  return check.pointsEarned > 0 ? "⚠️" : "❌";
}

/** Escapes text for a table cell. */
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export function renderMarkdown(result: ScanResult, options: ReportOptions): string {
  const out = [
    `# AI readiness report: ${repoName(result)}`,
    "",
    `**Score: ${result.score}/${result.maxScore}**, ${rating(result)} ${LEVEL_ICON[level(result.score, result.maxScore)]}`,
    "",
    "## Scores by category",
    "",
    "| Category | Score | |",
    "| --- | ---: | :---: |",
    ...result.categories.map(
      (c) => `| ${c.label} | ${c.pointsEarned}/${c.pointsPossible} | ${LEVEL_ICON[level(c.pointsEarned, c.pointsPossible)]} |`,
    ),
    "",
  ];

  const fixes = topFixes(result.checks);
  out.push("## Top fixes", "");
  if (fixes.length === 0) out.push("Every check passed. Nothing to fix.");
  else fixes.forEach((f, i) => out.push(`${i + 1}. **+${f.pointsGained}** ${f.fix}`));
  out.push("");

  out.push("## All checks", "");
  for (const category of result.categories) {
    out.push(
      `### ${category.label} (${category.pointsEarned}/${category.pointsPossible})`,
      "",
      "| | Check | Points | Finding | Fix |",
      "| :---: | --- | ---: | --- | --- |",
    );
    for (const check of result.checks.filter((c) => c.category === category.category)) {
      out.push(
        `| ${status(check)} | ${cell(check.title)} | ${check.pointsEarned}/${check.pointsPossible} | ${cell(check.finding)} | ${check.passed ? "" : cell(check.fix)} |`,
      );
    }
    out.push("");
  }

  out.push(
    "---",
    "",
    `Scanned ${plural(result.fileCount, "file")} in ${result.durationMs} ms with ai-readiness ${options.version}. ` +
      "✅ passed, ⚠️ partial credit, ❌ failed.",
    "",
  );
  return out.join("\n");
}
