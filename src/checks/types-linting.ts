import path from "node:path";
import type { Language } from "../classify.js";
import type { ScanContext } from "../context.js";
import type { Check, CheckOutcome } from "../types.js";
import { hasSection, mapLimit } from "../util/config.js";

const LANGUAGE_NAMES: Record<Language, string> = { js: "JS/TS", python: "Python" };
const PY_HINT_SAMPLE = 300;

interface LanguageCheck {
  label: string;
  score: (lang: Language) => Promise<{ earned: number; note: string }>;
  /** Fix for each language, as a clause; joined for languages that fall short. */
  fixes: Record<Language, string>;
  /** Fix sentence when every language earns full points. */
  keep: string;
}

/** Scores each language present and averages, so mixed repos need every language covered. */
async function perLanguage(ctx: ScanContext, points: number, check: LanguageCheck): Promise<CheckOutcome> {
  const langs = [...ctx.languages].sort();
  if (langs.length === 0) {
    return {
      earned: 0,
      finding: "No JS/TS or Python source files found.",
      fix: "Run the scanner on a directory that contains JS/TS or Python source.",
    };
  }
  const results = await Promise.all(langs.map(check.score));
  const earned = Math.round(results.reduce((sum, r) => sum + r.earned, 0) / langs.length);
  const short = langs.filter((_, i) => (results[i]?.earned ?? 0) < points).map((l) => check.fixes[l]);
  const fix = short.length === 0 ? check.keep : `${short.join(", and ")}.`;
  return {
    earned: Math.min(points, earned),
    finding: `${check.label}: ${results.map((r) => r.note).join("; ")}.`,
    fix: fix.charAt(0).toUpperCase() + fix.slice(1),
  };
}

// --- Strict types ----------------------------------------------------------

/** Follows relative `extends` to find compilerOptions.strict. */
async function tsconfigStrict(ctx: ScanContext, file: string, seen = new Set<string>()): Promise<boolean> {
  if (seen.has(file) || seen.size > 5) return false;
  seen.add(file);
  const config = await ctx.readJson(file);
  if (!config) return false;
  const strict = (config.compilerOptions as Record<string, unknown> | undefined)?.strict;
  if (typeof strict === "boolean") return strict;
  const bases = ([] as unknown[]).concat(config.extends ?? []).filter((e): e is string => typeof e === "string");
  for (const base of bases) {
    if (base.startsWith(".")) {
      let target = path.posix.normalize(path.posix.join(path.posix.dirname(file), base));
      if (!target.endsWith(".json")) target += ".json";
      if (await tsconfigStrict(ctx, target, seen)) return true;
    } else if (/strict/i.test(base)) {
      // Shared presets such as @tsconfig/strictest.
      return true;
    }
  }
  return false;
}

async function scoreJsTypes(ctx: ScanContext, points: number) {
  const configs = ["tsconfig.json", "jsconfig.json"].filter((f) => ctx.has(f));
  // Monorepos often have no root tsconfig, only per-package ones.
  if (configs.length === 0) configs.push(...ctx.match(/^(?:[^/]+\/){1,2}tsconfig\.json$/));
  if (configs.length === 0) return { earned: 0, note: "no tsconfig.json for JS/TS" };
  const strictCount = (await Promise.all(configs.map((c) => tsconfigStrict(ctx, c)))).filter(Boolean).length;
  if (strictCount === configs.length) return { earned: points, note: "TypeScript strict mode is on" };
  if (strictCount > 0) return { earned: Math.round(points * 0.66), note: `strict mode on in ${strictCount} of ${configs.length} tsconfig files` };
  return { earned: Math.round(points / 3), note: "tsconfig.json exists but strict mode is off" };
}

export async function findPythonTypeChecker(ctx: ScanContext): Promise<string | undefined> {
  if (ctx.has("mypy.ini") || ctx.has(".mypy.ini")) return "mypy";
  if (ctx.has("pyrightconfig.json")) return "pyright";
  const pyproject = await ctx.read("pyproject.toml");
  if (hasSection(pyproject, "tool.mypy")) return "mypy";
  if (hasSection(pyproject, "tool.pyright") || hasSection(pyproject, "tool.basedpyright")) return "pyright";
  if (hasSection(await ctx.read("setup.cfg"), "mypy")) return "mypy";
  return undefined;
}

/** Share of Python function definitions that have a parameter or return annotation. */
export function pythonHintRatio(sources: string[]): { annotated: number; total: number } {
  let annotated = 0;
  let total = 0;
  const def = /^\s*(?:async\s+)?def\s+\w+\s*\(([\s\S]*?)\)\s*(->)?[^:\n]*:/gm;
  for (const text of sources) {
    for (const m of text.matchAll(def)) {
      total++;
      const params = (m[1] ?? "").replace(/\b(?:self|cls)\b\s*,?/g, "");
      if (m[2] || params.includes(":")) annotated++;
    }
  }
  return { annotated, total };
}

async function scorePythonTypes(ctx: ScanContext, points: number) {
  const checker = await findPythonTypeChecker(ctx);
  if (checker) return { earned: points, note: `${checker} is configured` };
  const sample = ctx.sourceFiles.filter((f) => f.endsWith(".py")).slice(0, PY_HINT_SAMPLE);
  const texts = await mapLimit(sample, 64, async (f) => (await ctx.read(f)) ?? "");
  const { annotated, total } = pythonHintRatio(texts);
  const ratio = total === 0 ? 0 : annotated / total;
  const pct = Math.round(ratio * 100);
  const earned = ratio >= 0.6 ? Math.round(points * 0.66) : ratio >= 0.3 ? Math.round(points / 3) : 0;
  return { earned, note: `no mypy or pyright config, ${pct}% of Python functions have type hints` };
}

export const strictTypes: Check = {
  id: "types-strict",
  category: "types-linting",
  points: 6,
  async run(ctx) {
    const points = this.points;
    return perLanguage(ctx, points, {
      label: "Type checking",
      score: (lang) => (lang === "js" ? scoreJsTypes(ctx, points) : scorePythonTypes(ctx, points)),
      fixes: {
        js: 'turn on "strict": true in tsconfig.json',
        python: "add a [tool.mypy] section to pyproject.toml and type hints to public functions",
      },
      keep: "Keep strict type checking on and run it in CI.",
    });
  },
};

// --- Linter ----------------------------------------------------------------

const JS_LINT_FILES = /^(?:\.eslintrc(?:\.(?:js|cjs|json|ya?ml))?|eslint\.config\.[cm]?[jt]s|biome\.jsonc?|\.oxlintrc\.json)$/;
const PY_LINT_FILES = /^(?:\.?ruff\.toml|\.flake8|\.?pylintrc)$/;

export async function findLinter(ctx: ScanContext, lang: Language): Promise<string | undefined> {
  if (lang === "js") {
    const file = ctx.match(JS_LINT_FILES)[0];
    if (file) return file;
    return (await ctx.readJson("package.json"))?.eslintConfig ? "package.json eslintConfig" : undefined;
  }
  const file = ctx.match(PY_LINT_FILES)[0];
  if (file) return file;
  const pyproject = await ctx.read("pyproject.toml");
  if (hasSection(pyproject, "tool.ruff")) return "pyproject.toml [tool.ruff]";
  if (hasSection(pyproject, "tool.pylint")) return "pyproject.toml [tool.pylint]";
  if (hasSection(await ctx.read("setup.cfg"), "flake8")) return "setup.cfg [flake8]";
  if (hasSection(await ctx.read("tox.ini"), "flake8")) return "tox.ini [flake8]";
  return undefined;
}

export const linterConfig: Check = {
  id: "types-linter",
  category: "types-linting",
  points: 5,
  async run(ctx) {
    const points = this.points;
    return perLanguage(ctx, points, {
      label: "Linting",
      score: async (lang) => {
        const found = await findLinter(ctx, lang);
        return found
          ? { earned: points, note: `${LANGUAGE_NAMES[lang]} linter configured (${found})` }
          : { earned: 0, note: `no ${LANGUAGE_NAMES[lang]} linter config` };
      },
      fixes: {
        js: "add an eslint or biome config so agents get fast feedback on JS/TS",
        python: "add a [tool.ruff] section to pyproject.toml so agents get fast feedback on Python",
      },
      keep: "Run the linter in CI so agent changes follow the same rules.",
    });
  },
};

// --- Formatter -------------------------------------------------------------

const JS_FORMAT_FILES = /^(?:\.prettierrc(?:\.[a-z]+)?|prettier\.config\.[cm]?[jt]s|biome\.jsonc?|dprint\.json)$/;

export async function findFormatter(ctx: ScanContext, lang: Language): Promise<string | undefined> {
  const preCommit = (await ctx.read(".pre-commit-config.yaml")) ?? "";
  if (lang === "js") {
    const file = ctx.match(JS_FORMAT_FILES)[0];
    if (file) return file;
    if ((await ctx.readJson("package.json"))?.prettier) return "package.json prettier";
    return /prettier/.test(preCommit) ? ".pre-commit-config.yaml" : undefined;
  }
  const pyproject = await ctx.read("pyproject.toml");
  if (hasSection(pyproject, "tool.black")) return "black";
  if (hasSection(pyproject, "tool.ruff.format")) return "ruff format";
  for (const f of ["ruff.toml", ".ruff.toml"]) if (hasSection(await ctx.read(f), "format")) return "ruff format";
  if (hasSection(pyproject, "tool.yapf") || ctx.has(".style.yapf")) return "yapf";
  if (/\b(?:black|ruff-format)\b/.test(preCommit)) return ".pre-commit-config.yaml";
  return undefined;
}

export const formatterConfig: Check = {
  id: "types-formatter",
  category: "types-linting",
  points: 4,
  async run(ctx) {
    const points = this.points;
    return perLanguage(ctx, points, {
      label: "Formatting",
      score: async (lang) => {
        const found = await findFormatter(ctx, lang);
        return found
          ? { earned: points, note: `${LANGUAGE_NAMES[lang]} formatter configured (${found})` }
          : { earned: 0, note: `no ${LANGUAGE_NAMES[lang]} formatter config` };
      },
      fixes: {
        js: "add a prettier or biome config so JS/TS diffs from agents stay clean",
        python: "configure black or ruff format so Python diffs from agents stay clean",
      },
      keep: "Check formatting in CI to keep diffs from agents small.",
    });
  },
};

export const typesLintingChecks = [strictTypes, linterConfig, formatterConfig];
