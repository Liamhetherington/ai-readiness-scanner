import { isExcludedPath } from "../classify.js";
import type { ScanContext } from "../context.js";
import type { Check } from "../types.js";

const README = /^readme(?:\.(?:md|markdown|rst|txt))?$/i;

interface Topic {
  name: string;
  heading: RegExp;
  command: RegExp;
}

/** A README covers a topic if a heading names it or it shows the relevant command. */
export const README_TOPICS: Topic[] = [
  {
    name: "setup",
    heading: /\b(?:install(?:ation|ing)?|set ?up|getting started|prerequisites|requirements)\b/i,
    command: /\b(?:npm (?:install|ci)|pnpm install|yarn install|pip install|poetry install|uv sync)\b/,
  },
  {
    name: "run",
    heading: /\b(?:usage|run(?:ning)?|quick ?start|development|develop|start)\b/i,
    command: /\b(?:npm (?:start|run (?:dev|start))|yarn (?:dev|start)|pnpm (?:dev|start)|python -m \w|uvicorn|flask run|node \S+\.js)\b/,
  },
  {
    name: "test",
    heading: /\btest(?:s|ing)?\b/i,
    command: /\b(?:(?:npm|pnpm|yarn|bun) (?:run )?test|pytest|vitest|jest|tox)\b/,
  },
];

const findReadme = (ctx: ScanContext) => ctx.files.find((f) => README.test(f));

export function readmeHeadings(text: string): string[] {
  const markdown = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1] ?? "");
  // reStructuredText: a title line followed by a line of =, -, ~ or ^.
  const rst = [...text.matchAll(/^(.+)\n[=\-~^]{3,}\s*$/gm)].map((m) => m[1] ?? "");
  return [...markdown, ...rst];
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export const readmeExists: Check = {
  id: "docs-readme",
  category: "documentation",
  points: 4,
  async run(ctx) {
    const readme = findReadme(ctx);
    return readme
      ? { earned: this.points, finding: `Found ${readme}.`, fix: "Keep the README as the entry point for humans and agents." }
      : { earned: 0, finding: "No README at the repo root.", fix: "Add a README.md describing what the project does and how to set it up, run it and test it." };
  },
};

export const readmeLength: Check = {
  id: "docs-readme-length",
  category: "documentation",
  points: 4,
  async run(ctx) {
    const readme = findReadme(ctx);
    if (!readme) return { earned: 0, finding: "No README to measure.", fix: "Add a README.md of at least 300 words." };
    const words = wordCount((await ctx.read(readme)) ?? "");
    const earned = words >= 300 ? 4 : words >= 100 ? 2 : 0;
    return {
      earned,
      finding: `${readme} has ${words} words.`,
      fix:
        earned === this.points
          ? "Prune outdated sections as the project changes."
          : `Expand ${readme} to at least 300 words covering purpose, setup, usage and project layout.`,
    };
  },
};

export const readmeSections: Check = {
  id: "docs-readme-sections",
  category: "documentation",
  points: 6,
  async run(ctx) {
    const readme = findReadme(ctx);
    if (!readme) {
      return { earned: 0, finding: "No README to check for setup, run and test sections.", fix: "Add a README.md with Setup, Usage and Testing sections." };
    }
    const text = (await ctx.read(readme)) ?? "";
    const headings = readmeHeadings(text);
    const missing = README_TOPICS.filter(
      (t) => !headings.some((h) => t.heading.test(h)) && !t.command.test(text),
    ).map((t) => t.name);
    const covered = README_TOPICS.length - missing.length;
    return {
      earned: covered * 2,
      finding:
        missing.length === 0
          ? `${readme} covers setup, running and testing.`
          : `${readme} does not cover: ${missing.join(", ")}.`,
      fix:
        missing.length === 0
          ? "Keep the commands in the README in sync with the real ones."
          : `Add README sections with exact commands for: ${missing.join(", ")}.`,
    };
  },
};

export const docsFolder: Check = {
  id: "docs-folder",
  category: "documentation",
  points: 3,
  async run(ctx) {
    const docs = ctx.match(/^docs?\/.+\.(?:md|mdx|rst|txt)$/i);
    return docs.length > 0
      ? { earned: this.points, finding: `Found ${docs.length} document${docs.length === 1 ? "" : "s"} in a docs folder.`, fix: "Link the key docs from the README and your agent context file." }
      : { earned: 0, finding: "No docs/ folder with written documentation.", fix: "Add a docs/ folder for architecture, conventions and how-to guides." };
  },
};

export const decisionRecords: Check = {
  id: "docs-adr",
  category: "documentation",
  points: 3,
  async run(ctx) {
    const adrs = ctx
      .match(/(?:^|\/)(?:adrs?|decisions|decision-records|architecture-decisions)\/[^/]+\.(?:md|mdx|rst)$/i)
      .filter((f) => !isExcludedPath(f));
    if (adrs.length > 0) {
      return { earned: this.points, finding: `Found ${adrs.length} architecture decision record${adrs.length === 1 ? "" : "s"}.`, fix: "Record new significant decisions as ADRs so agents understand why the code is shaped this way." };
    }
    const architecture = ctx.match(/^(?:docs?\/)?architecture\.md$/i)[0];
    if (architecture) {
      return { earned: 2, finding: `Found ${architecture} but no architecture decision records.`, fix: "Add a docs/adr/ folder and record key decisions there, one file per decision." };
    }
    return { earned: 0, finding: "No architecture decision records or architecture doc found.", fix: "Add a docs/adr/ folder and record key decisions there, one file per decision." };
  },
};

export const documentationChecks = [readmeExists, readmeLength, readmeSections, docsFolder, decisionRecords];
