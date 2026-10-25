#!/usr/bin/env node
import { realpathSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Option } from "commander";
import { render } from "./report/index.js";
import { shouldColor } from "./report/terminal.js";
import { scan, type ScanResult } from "./scan.js";
import type { AiSummary, OutputFormat } from "./types.js";
import { packageVersion } from "./version.js";

export interface CliOptions {
  repoPath: string;
  format: OutputFormat;
  out?: string;
  llm: boolean;
}

/** Parses argv (including the node and script entries) into options. Throws on invalid input. */
export function parseArgs(argv: string[]): CliOptions {
  let options: CliOptions | undefined;

  const program = new Command()
    .name("ai-readiness")
    .description("Score how ready a codebase is for AI coding agents.")
    .version(packageVersion())
    .argument("[path]", "path to the repository to scan", ".")
    .addOption(
      new Option("-f, --format <format>", "output format")
        .choices(["terminal", "md", "json"])
        .default("terminal"),
    )
    .option("-o, --out <file>", "write the report to a file instead of stdout")
    .option("--llm", "add an AI-written summary (needs ANTHROPIC_API_KEY)", false)
    .exitOverride()
    .action((repoPath: string, opts: { format: OutputFormat; out?: string; llm: boolean }) => {
      options = { repoPath, ...opts };
    });

  program.parse(argv);
  if (!options) throw new Error("No options parsed");
  return options;
}

export async function run(argv: string[]): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (err) {
    // commander has already printed help, version or the parse error.
    const code = (err as { exitCode?: number }).exitCode;
    return typeof code === "number" ? code : 1;
  }

  const root = path.resolve(options.repoPath);
  if (!isDirectory(root)) {
    console.error(`error: not a directory: ${options.repoPath}`);
    return 1;
  }

  const result = await scan(root);
  if (options.llm) result.aiSummary = await tryAiSummary(result);

  const report = render(result, options.format, {
    version: packageVersion(),
    // Files never get colour codes; stdout gets them only on a terminal.
    color: !options.out && shouldColor(process.stdout),
    width: process.stdout.columns,
  });

  if (!options.out) {
    process.stdout.write(report);
    return 0;
  }
  const outPath = path.resolve(options.out);
  try {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, report);
  } catch (err) {
    console.error(`error: could not write ${options.out}: ${(err as Error).message}`);
    return 1;
  }
  console.error(`Wrote ${options.format} report to ${options.out} (score ${result.score}/${result.maxScore})`);
  return 0;
}

/** Adds the AI summary, or explains on stderr why it couldn't. Never fails the run. */
async function tryAiSummary(result: ScanResult): Promise<AiSummary | undefined> {
  // Loaded only for --llm, so plain scans never pay for the SDK.
  const llm = await import("./llm/summary.js");
  if (!llm.hasApiKey()) {
    console.error(`warning: ${llm.MISSING_KEY_MESSAGE}`);
    return undefined;
  }
  if (process.stderr.isTTY) console.error(`Asking ${llm.SUMMARY_MODEL} for a summary (scan results only, no source code)...`);
  try {
    return await llm.summarize(result);
  } catch (err) {
    if (!(err instanceof llm.LlmSummaryError)) throw err;
    console.error(`warning: AI summary unavailable: ${err.message} The report below is complete without it.`);
    return undefined;
  }
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  // npx and npm link run the bin through a symlink, so compare real paths.
  return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  // The reader closed the pipe early (e.g. `| head`): stop quietly, like other Unix tools.
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") process.exit(0);
    throw err;
  });
  run(process.argv).then((code) => {
    process.exitCode = code;
  });
}
