import { describe, expect, it } from "vitest";
import { isSourceFile, isTestFile, languageOf } from "../src/classify.js";

describe("languageOf", () => {
  it.each([
    ["a.ts", "js"],
    ["a.tsx", "js"],
    ["a.mjs", "js"],
    ["a.cjs", "js"],
    ["a.py", "python"],
    ["a.go", undefined],
    ["a.md", undefined],
  ])("%s -> %s", (file, lang) => expect(languageOf(file)).toBe(lang));
});

describe("isTestFile", () => {
  it.each([
    "src/a.test.ts",
    "src/a.spec.jsx",
    "src/__tests__/a.ts",
    "tests/helpers.ts",
    "test/a.js",
    "pkg/tests/test_api.py",
    "test_api.py",
    "api_test.py",
  ])("treats %s as a test", (file) => expect(isTestFile(file)).toBe(true));

  it.each(["src/testing.ts", "src/latest.py", "contest.py", "README.md", "test/fixtures/repo/src/a.ts"])(
    "does not treat %s as a test",
    (file) => expect(isTestFile(file)).toBe(false),
  );
});

describe("isSourceFile", () => {
  it.each(["src/index.ts", "app/main.py", "lib/a.jsx"])("treats %s as source", (file) =>
    expect(isSourceFile(file)).toBe(true),
  );

  it.each([
    "src/index.test.ts",
    "types/global.d.ts",
    "public/app.min.js",
    "eslint.config.js",
    "vitest.config.ts",
    ".eslintrc.js",
    "tests/conftest.py",
    "conftest.py",
    "vendor/lib.js",
    "src/generated/client.ts",
    "test/fixtures/repo/src/a.ts",
    "docs/guide.md",
  ])("excludes %s", (file) => expect(isSourceFile(file)).toBe(false));
});
