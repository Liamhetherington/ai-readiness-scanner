import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import ignore, { type Ignore } from "ignore";

/**
 * Directories that are never worth scanning. They are skipped during traversal,
 * before .gitignore rules apply, so large dependency folders don't slow the scan.
 */
export const ALWAYS_IGNORED_DIRS = [
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".tox",
];

export interface WalkResult {
  /** Absolute path of the scanned root. */
  root: string;
  /** Files relative to root, using forward slashes, sorted. */
  files: string[];
}

interface GitignoreScope {
  /** Directory of the .gitignore, relative to root ("" for the root itself). */
  dir: string;
  matcher: Ignore;
}

/** Lists every file under `root`, skipping anything matched by a .gitignore. */
export async function walkRepo(root: string): Promise<WalkResult> {
  const absRoot = path.resolve(root);
  const skipDirs = ALWAYS_IGNORED_DIRS.map((d) => `**/${d}/**`);

  const entries = await fg("**/*", {
    cwd: absRoot,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: skipDirs,
  });

  const scopes = await loadGitignores(
    absRoot,
    entries.filter((f) => path.posix.basename(f) === ".gitignore"),
  );

  const files = entries.filter((f) => !isIgnored(f, scopes)).sort();
  return { root: absRoot, files };
}

async function loadGitignores(absRoot: string, gitignoreFiles: string[]): Promise<GitignoreScope[]> {
  const scopes = await Promise.all(
    gitignoreFiles.map(async (file) => {
      const content = await readFile(path.join(absRoot, file), "utf8");
      const dir = path.posix.dirname(file);
      return { dir: dir === "." ? "" : dir, matcher: ignore().add(content) };
    }),
  );
  // Shallowest first, so a parent's rules are checked before a child's.
  return scopes.sort((a, b) => depth(a.dir) - depth(b.dir));
}

/**
 * Follows git's precedence: deeper .gitignore files override shallower ones
 * (so `!pattern` can re-include a file), but nothing can re-include a file
 * whose parent directory is excluded.
 */
function isIgnored(file: string, scopes: GitignoreScope[]): boolean {
  let ignored = false;
  for (const scope of scopes) {
    if (scope.dir !== "" && !file.startsWith(`${scope.dir}/`)) continue;
    const relative = scope.dir === "" ? file : file.slice(scope.dir.length + 1);
    if (parentDirs(relative).some((dir) => scope.matcher.ignores(`${dir}/`))) return true;
    const result = scope.matcher.test(relative);
    if (result.ignored) ignored = true;
    else if (result.unignored) ignored = false;
  }
  return ignored;
}

function parentDirs(file: string): string[] {
  const parts = file.split("/").slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
}

function depth(dir: string): number {
  return dir === "" ? 0 : dir.split("/").length;
}
