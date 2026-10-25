#!/usr/bin/env node
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Option } from "commander";
import { walkRepo } from "./walker.js";

export type OutputFormat = "terminal" | "md" | "json";

export interface CliOptions {
  repoPath: string;
  format: OutputFormat;
  out?: string;
  llm: boolean;
}

function packageVersion(): string {
  const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
  return (JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string }).version;
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

  const started = performance.now();
  const { files } = await walkRepo(root);
  const elapsedMs = Math.round(performance.now() - started);

  console.log(`Scanned ${files.length} files in ${root} (${elapsedMs} ms)`);
  return 0;
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
  run(process.argv).then((code) => {
    process.exitCode = code;
  });
}
