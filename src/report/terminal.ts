import type { ScanResult } from "../scan.js";
import { topFixes } from "../scoring.js";
import { level, plural, rating, repoName, type Level, type ReportOptions } from "./shared.js";

export interface TerminalOptions extends ReportOptions {
  color: boolean;
  /** Line width used for wrapping fix text. */
  width?: number;
}

const BAR_WIDTH = 20;
const ANSI = { bold: 1, dim: 2, red: 31, green: 32, yellow: 33 } as const;
const LEVEL_COLOR: Record<Level, keyof typeof ANSI> = { good: "green", fair: "yellow", poor: "red" };

/** Whether to colour output for a stream, following the NO_COLOR and FORCE_COLOR conventions. */
export function shouldColor(stream: { isTTY?: boolean }, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NO_COLOR) return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== "0") return true;
  return Boolean(stream.isTTY);
}

export function renderTerminal(result: ScanResult, options: TerminalOptions): string {
  const paint = (style: keyof typeof ANSI, text: string) =>
    options.color ? `\x1b[${ANSI[style]}m${text}\x1b[0m` : text;
  const width = Math.max(60, Math.min(options.width ?? 80, 100));
  const labelWidth = Math.max(...result.categories.map((c) => c.label.length)) + 2;

  const overall = level(result.score, result.maxScore);
  const out = [
    "",
    paint("bold", `AI Readiness: ${repoName(result)}`),
    "",
    `Score  ${paint("bold", paint(LEVEL_COLOR[overall], `${result.score}/${result.maxScore}`))}  ${rating(result)}`,
    "",
  ];

  for (const c of result.categories) {
    const filled = c.pointsPossible === 0 ? 0 : Math.round((c.pointsEarned / c.pointsPossible) * BAR_WIDTH);
    const bar = paint(LEVEL_COLOR[level(c.pointsEarned, c.pointsPossible)], "█".repeat(filled)) +
      paint("dim", "░".repeat(BAR_WIDTH - filled));
    const points = `${c.pointsEarned}/${c.pointsPossible}`.padStart(5);
    out.push(`${c.label.padEnd(labelWidth)}${bar}  ${points}`);
  }

  const fixes = topFixes(result.checks);
  out.push("");
  if (fixes.length === 0) {
    out.push("Every check passed. Nothing to fix.");
  } else {
    out.push(paint("bold", "Top fixes"));
    fixes.forEach((f, i) => {
      const prefix = `${String(i + 1).padStart(2)}. ${`+${f.pointsGained}`.padStart(3)}  `;
      const [first = "", ...rest] = wrap(f.fix, width - prefix.length);
      out.push(prefix.replace(/\+\d+/, (m) => paint("green", m)) + first);
      for (const line of rest) out.push(" ".repeat(prefix.length) + line);
    });
  }

  out.push(
    "",
    paint(
      "dim",
      `Scanned ${plural(result.fileCount, "file")} in ${result.durationMs} ms. Use --format md for the full report.`,
    ),
    "",
  );
  return out.join("\n");
}

export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
