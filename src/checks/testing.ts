import type { ScanContext } from "../context.js";
import type { Check } from "../types.js";
import { hasSection } from "../util/config.js";

const CI_FILES =
  /^(?:\.github\/workflows\/[^/]+\.ya?ml|\.gitlab-ci\.yml|\.circleci\/config\.yml|azure-pipelines\.yml|bitbucket-pipelines\.yml|\.travis\.yml|Jenkinsfile)$/;
const CI_TEST_COMMAND =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|npm\s+t\b|vitest|jest|mocha|pytest|tox|nox|make\s+test|python\s+-m\s+(?:pytest|unittest))\b/;
const NPM_DEFAULT_TEST = /no test specified/;

export const testFilesExist: Check = {
  id: "testing-files",
  category: "testing",
  points: 7,
  async run(ctx) {
    const count = ctx.testFiles.length;
    if (count > 0) {
      return {
        earned: this.points,
        finding: `Found ${count} test file${count === 1 ? "" : "s"}.`,
        fix: "Keep adding tests alongside new code so agents can check their changes.",
      };
    }
    return {
      earned: 0,
      finding: "No test files found.",
      fix: "Add a test suite (vitest or jest for JS/TS, pytest for Python) so agents can verify their changes.",
    };
  },
};

/** Where a test command is defined, or undefined if nowhere. */
export async function findTestCommand(ctx: ScanContext): Promise<string | undefined> {
  const pkg = await ctx.readJson("package.json");
  const scripts = pkg?.scripts as Record<string, unknown> | undefined;
  if (typeof scripts?.test === "string" && !NPM_DEFAULT_TEST.test(scripts.test)) return "package.json scripts.test";

  if (ctx.has("pytest.ini")) return "pytest.ini";
  if (hasSection(await ctx.read("pyproject.toml"), "tool.pytest")) return "pyproject.toml [tool.pytest]";
  if (hasSection(await ctx.read("setup.cfg"), "tool:pytest")) return "setup.cfg [tool:pytest]";
  if (ctx.has("tox.ini")) return "tox.ini";
  if (ctx.has("noxfile.py")) return "noxfile.py";
  if (/^test:/m.test((await ctx.read("Makefile")) ?? "")) return "Makefile test target";
  return undefined;
}

export const testCommandDefined: Check = {
  id: "testing-command",
  category: "testing",
  points: 6,
  async run(ctx) {
    const source = await findTestCommand(ctx);
    if (source) {
      return {
        earned: this.points,
        finding: `A test command is defined in ${source}.`,
        fix: "Mention the test command in your agent context file so agents run it.",
      };
    }
    return {
      earned: 0,
      finding: "No test command is defined in package.json, pyproject.toml, pytest.ini, setup.cfg, tox.ini or a Makefile.",
      fix: 'Define one standard test command, such as a "test" script in package.json or a [tool.pytest.ini_options] table in pyproject.toml.',
    };
  },
};

export const testRatio: Check = {
  id: "testing-ratio",
  category: "testing",
  points: 6,
  async run(ctx) {
    const sources = ctx.sourceFiles.length;
    const tests = ctx.testFiles.length;
    if (sources === 0) {
      return {
        earned: 0,
        finding: "No JS/TS or Python source files found to compare tests against.",
        fix: "Run the scanner on a directory that contains JS/TS or Python source.",
      };
    }
    const ratio = tests / sources;
    const earned = ratio >= 0.5 ? 6 : ratio >= 0.25 ? 4 : ratio >= 0.1 ? 2 : 0;
    const finding = `${tests} test file${tests === 1 ? "" : "s"} for ${sources} source file${sources === 1 ? "" : "s"} (ratio ${ratio.toFixed(2)}).`;
    return {
      earned,
      finding,
      fix:
        earned === this.points
          ? "Maintain at least one test file for every two source files."
          : "Add tests for the most-changed modules until there is at least one test file per two source files.",
    };
  },
};

export const ciRunsTests: Check = {
  id: "testing-ci",
  category: "testing",
  points: 6,
  async run(ctx) {
    const ciFiles = ctx.match(CI_FILES);
    if (ciFiles.length === 0) {
      return {
        earned: 0,
        finding: "No CI configuration found.",
        fix: "Add a CI workflow (for example .github/workflows/ci.yml) that runs the test suite on every pull request.",
      };
    }
    for (const file of ciFiles) {
      if (CI_TEST_COMMAND.test((await ctx.read(file)) ?? "")) {
        return {
          earned: this.points,
          finding: `CI runs tests (${file}).`,
          fix: "Make the CI test job required before merging so agent changes are always verified.",
        };
      }
    }
    return {
      earned: 2,
      finding: `CI is configured (${ciFiles.join(", ")}) but no step appears to run tests.`,
      fix: "Add a step to the CI workflow that runs the test suite.",
    };
  },
};

export const testingChecks = [testFilesExist, testCommandDefined, testRatio, ciRunsTests];
