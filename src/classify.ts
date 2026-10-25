export type Language = "js" | "python";

const JS_EXT = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const PY_EXT = /\.py$/;

/** Paths that hold sample data, vendored or generated code rather than the project's own code. */
const EXCLUDED_DIR = /(?:^|\/)(?:fixtures|__fixtures__|vendor|third_party|generated|__generated__)\//;
const EXCLUDED_FILE = /(?:\.d\.ts|\.min\.js|\.bundle\.js)$/;
/** Tool configuration such as eslint.config.js or vitest.config.ts. */
const CONFIG_FILE = /(?:^|\/)(?:[^/]+\.config\.[cm]?[jt]s|\.[^/]+rc\.[cm]?js|conftest\.py|noxfile\.py)$/;

const JS_TEST = /(?:\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$|(?:^|\/)__tests__\/)/;
const PY_TEST = /(?:(?:^|\/)test_[^/]*\.py$|_test\.py$)/;
const TEST_DIR = /(?:^|\/)(?:tests?|__tests__|spec)\//;

/** True for sample data, vendored or generated paths, which say nothing about the project itself. */
export function isExcludedPath(file: string): boolean {
  return EXCLUDED_DIR.test(file);
}

export function languageOf(file: string): Language | undefined {
  if (PY_EXT.test(file)) return "python";
  if (JS_EXT.test(file)) return "js";
  return undefined;
}

/** True for JS/TS/Python files that belong to the project itself (source or tests). */
export function isOwnCode(file: string): boolean {
  return (
    languageOf(file) !== undefined &&
    !isExcludedPath(file) &&
    !EXCLUDED_FILE.test(file) &&
    !CONFIG_FILE.test(file)
  );
}

export function isTestFile(file: string): boolean {
  if (!isOwnCode(file)) return false;
  if (TEST_DIR.test(file)) return true;
  return languageOf(file) === "python" ? PY_TEST.test(file) : JS_TEST.test(file);
}

export function isSourceFile(file: string): boolean {
  return isOwnCode(file) && !isTestFile(file);
}
