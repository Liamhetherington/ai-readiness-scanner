import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Fixture repos contain their own test files, which are scan input, not tests to run.
    exclude: [...configDefaults.exclude, "test/fixtures/**"],
  },
});
