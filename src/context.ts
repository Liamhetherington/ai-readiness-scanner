import { readFile } from "node:fs/promises";
import path from "node:path";
import { isSourceFile, isTestFile, languageOf, type Language } from "./classify.js";
import { mapLimit } from "./util/config.js";
import { parseJsonc } from "./util/jsonc.js";

/** Files above this size are treated as generated and not read. */
const MAX_READ_BYTES = 2 * 1024 * 1024;

export type FileReader = (relativePath: string) => Promise<string | undefined>;

export interface ScanContext {
  root: string;
  /** Every non-ignored file, relative to root with forward slashes. */
  files: string[];
  sourceFiles: string[];
  testFiles: string[];
  /** Languages that have at least one source file. */
  languages: Set<Language>;
  has(file: string): boolean;
  /** Files whose path matches the pattern. */
  match(pattern: RegExp): string[];
  /** File contents, or undefined if missing or unreadable. Cached. */
  read(file: string): Promise<string | undefined>;
  readJson(file: string): Promise<Record<string, unknown> | undefined>;
  /** Line counts for every source file. Computed once. */
  sourceLineCounts(): Promise<Map<string, number>>;
}

export function createContext(root: string, files: string[], reader: FileReader = diskReader(root)): ScanContext {
  const fileSet = new Set(files);
  const cache = new Map<string, Promise<string | undefined>>();
  const sourceFiles = files.filter(isSourceFile);
  const testFiles = files.filter(isTestFile);
  let lineCounts: Promise<Map<string, number>> | undefined;

  const read = (file: string) => {
    if (!fileSet.has(file)) return Promise.resolve(undefined);
    let content = cache.get(file);
    if (!content) {
      content = reader(file);
      cache.set(file, content);
    }
    return content;
  };

  return {
    root,
    files,
    sourceFiles,
    testFiles,
    languages: new Set(sourceFiles.map((f) => languageOf(f)).filter((l): l is Language => l !== undefined)),
    has: (file) => fileSet.has(file),
    match: (pattern) => files.filter((f) => pattern.test(f)),
    read,
    async readJson(file) {
      const text = await read(file);
      if (text === undefined) return undefined;
      try {
        const value = parseJsonc(text);
        return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
      } catch {
        return undefined;
      }
    },
    sourceLineCounts() {
      lineCounts ??= mapLimit(sourceFiles, 64, async (file) => {
        // Not cached in `read`: most source files are only needed for counting.
        const text = await reader(file);
        return [file, text === undefined ? 0 : countLines(text)] as const;
      }).then((entries) => new Map(entries));
      return lineCounts;
    },
  };
}

export function countLines(text: string): number {
  if (text.length === 0) return 0;
  let lines = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
  return text.endsWith("\n") ? lines - 1 : lines;
}

function diskReader(root: string): FileReader {
  return async (file) => {
    try {
      const buf = await readFile(path.join(root, file));
      return buf.length > MAX_READ_BYTES ? undefined : buf.toString("utf8");
    } catch {
      return undefined;
    }
  };
}
