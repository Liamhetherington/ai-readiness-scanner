import { describe, expect, it } from "vitest";
import { ciRunsTests, testCommandDefined, testFilesExist, testRatio } from "../../src/checks/testing.js";
import { runCheck } from "../helpers/context.js";

describe("testing-files", () => {
  it("passes with any test file", async () => {
    expect((await runCheck(testFilesExist, { "src/a.ts": "", "src/a.test.ts": "" })).passed).toBe(true);
    expect((await runCheck(testFilesExist, { "app.py": "", "tests/test_app.py": "" })).passed).toBe(true);
  });

  it("fails with no test files", async () => {
    const r = await runCheck(testFilesExist, { "src/a.ts": "" });
    expect(r.earned).toBe(0);
    expect(r.finding).toBe("No test files found.");
  });
});

describe("testing-command", () => {
  it("passes with a real package.json test script", async () => {
    const r = await runCheck(testCommandDefined, { "package.json": '{"scripts":{"test":"vitest run"}}' });
    expect(r.passed).toBe(true);
    expect(r.finding).toContain("package.json");
  });

  it("fails with npm's default placeholder script", async () => {
    const pkg = JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } });
    expect((await runCheck(testCommandDefined, { "package.json": pkg })).earned).toBe(0);
  });

  it.each([
    ["pytest.ini", "[pytest]\n"],
    ["pyproject.toml", "[tool.pytest.ini_options]\ntestpaths = ['tests']\n"],
    ["setup.cfg", "[tool:pytest]\naddopts = -q\n"],
    ["tox.ini", "[tox]\n"],
    ["Makefile", "build:\n\tgo build\n\ntest:\n\tpytest\n"],
  ])("passes with %s", async (file, content) => {
    expect((await runCheck(testCommandDefined, { [file]: content })).passed).toBe(true);
  });

  it("fails with a pyproject that has no pytest config and a broken package.json", async () => {
    const r = await runCheck(testCommandDefined, { "pyproject.toml": "[project]\nname='x'\n", "package.json": "{oops" });
    expect(r.earned).toBe(0);
  });
});

describe("testing-ratio", () => {
  const repo = (sources: number, tests: number) => {
    const files: Record<string, string> = {};
    for (let i = 0; i < sources; i++) files[`src/m${i}.ts`] = "";
    for (let i = 0; i < tests; i++) files[`src/m${i}.test.ts`] = "";
    return files;
  };

  it.each([
    [10, 5, 6],
    [10, 3, 4],
    [10, 1, 2],
    [20, 1, 0],
    [10, 0, 0],
  ])("%i sources and %i tests earn %i", async (sources, tests, earned) => {
    expect((await runCheck(testRatio, repo(sources, tests))).earned).toBe(earned);
  });

  it("reports the ratio in the finding", async () => {
    expect((await runCheck(testRatio, repo(4, 1))).finding).toBe("1 test file for 4 source files (ratio 0.25).");
  });

  it("earns nothing when there is no source", async () => {
    expect((await runCheck(testRatio, { "README.md": "" })).earned).toBe(0);
  });
});

describe("testing-ci", () => {
  it.each([
    [".github/workflows/ci.yml", "steps:\n  - run: npm test\n"],
    [".github/workflows/ci.yaml", "steps:\n  - run: pnpm run test\n"],
    [".gitlab-ci.yml", "test:\n  script: pytest -q\n"],
    [".circleci/config.yml", "steps:\n  - run: npx vitest run\n"],
    ["Jenkinsfile", "sh 'python -m pytest'"],
  ])("passes when %s runs tests", async (file, content) => {
    expect((await runCheck(ciRunsTests, { [file]: content })).passed).toBe(true);
  });

  it("gives partial credit when CI exists but runs no tests", async () => {
    const r = await runCheck(ciRunsTests, { ".github/workflows/lint.yml": "steps:\n  - run: npm run lint\n" });
    expect(r.earned).toBe(2);
    expect(r.fix).toMatch(/runs the test suite/);
  });

  it("does not count words that merely contain 'test'", async () => {
    const r = await runCheck(ciRunsTests, { ".github/workflows/ci.yml": "name: latest-release\nsteps:\n  - run: npm run build\n" });
    expect(r.earned).toBe(2);
  });

  it("fails without CI", async () => {
    expect((await runCheck(ciRunsTests, { "src/a.ts": "" })).earned).toBe(0);
  });
});
