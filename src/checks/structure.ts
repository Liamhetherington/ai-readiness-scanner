import type { Check } from "../types.js";

export const LARGE_FILE_LINES = 500;
export const DEEP_NESTING = 6;

const noCode = {
  earned: 0,
  finding: "No JS/TS or Python source files found.",
  fix: "Run the scanner on a directory that contains JS/TS or Python source.",
};

const dirDepth = (file: string) => file.split("/").length - 1;

export const largeFiles: Check = {
  id: "structure-large-files",
  title: "Files over 500 lines",
  category: "structure",
  points: 8,
  async run(ctx) {
    const counts = await ctx.sourceLineCounts();
    if (counts.size === 0) return noCode;
    const large = [...counts].filter(([, lines]) => lines > LARGE_FILE_LINES).sort((a, b) => b[1] - a[1]);
    const share = large.length / counts.size;
    const earned = large.length === 0 ? 8 : share <= 0.02 ? 5 : share <= 0.05 ? 3 : share <= 0.1 ? 1 : 0;
    if (large.length === 0) {
      return { earned, finding: `No source files over ${LARGE_FILE_LINES} lines.`, fix: "Split files before they grow past 500 lines." };
    }
    const worst = large.slice(0, 3).map(([f, n]) => `${f} (${n})`).join(", ");
    return {
      earned,
      finding: `${large.length} of ${counts.size} source files ${large.length === 1 ? "is" : "are"} over ${LARGE_FILE_LINES} lines, the largest being ${worst}.`,
      fix: "Split the largest files into smaller modules with one responsibility each, so agents can load only what they need.",
    };
  },
};

export const averageFileLength: Check = {
  id: "structure-average-length",
  title: "Average file length",
  category: "structure",
  points: 6,
  async run(ctx) {
    const counts = await ctx.sourceLineCounts();
    if (counts.size === 0) return noCode;
    const avg = Math.round([...counts.values()].reduce((a, b) => a + b, 0) / counts.size);
    const earned = avg <= 200 ? 6 : avg <= 300 ? 4 : avg <= 400 ? 2 : 0;
    return {
      earned,
      finding: `Source files average ${avg} lines.`,
      fix:
        earned === this.points
          ? "Keep modules small and focused."
          : "Break long modules into smaller ones to bring the average under 200 lines.",
    };
  },
};

export const folderNesting: Check = {
  id: "structure-nesting",
  title: "Folder nesting depth",
  category: "structure",
  points: 6,
  async run(ctx) {
    if (ctx.sourceFiles.length === 0) return noCode;
    const depths = ctx.sourceFiles.map(dirDepth);
    const maxDepth = Math.max(...depths);
    const deep = depths.filter((d) => d > DEEP_NESTING).length;
    const share = deep / depths.length;
    const earned = deep === 0 ? 6 : share <= 0.1 ? 3 : 0;
    return {
      earned,
      finding:
        deep === 0
          ? `Source folders nest at most ${maxDepth} levels deep.`
          : `${deep} source file${deep === 1 ? " is" : "s are"} nested more than ${DEEP_NESTING} folders deep (max ${maxDepth}).`,
      fix:
        deep === 0
          ? "Keep the folder layout shallow and predictable."
          : `Flatten the folder structure so source files sit no more than ${DEEP_NESTING} levels deep.`,
    };
  },
};

export const structureChecks = [largeFiles, averageFileLength, folderNesting];
