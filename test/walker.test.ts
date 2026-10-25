import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { walkRepo } from "../src/walker.js";
import { createFixture } from "./helpers/fixture.js";

describe("walkRepo", () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>;

  beforeAll(async () => {
    fixture = await createFixture({
      ".gitignore": "dist/\n*.log\n.env\n",
      ".env": "SECRET=1",
      ".github/workflows/ci.yml": "on: push",
      "CLAUDE.md": "# Context",
      "README.md": "# Demo",
      "package.json": "{}",
      "src/index.ts": "export {};",
      "src/util.ts": "export {};",
      "src/debug.log": "noise",
      "dist/index.js": "built",
      "node_modules/left-pad/index.js": "dep",
      ".git/HEAD": "ref: refs/heads/main",
      "py/.gitignore": "generated/\n!keep.log\n",
      "py/app.py": "print('hi')",
      "py/generated/out.py": "x = 1",
      "py/__pycache__/app.cpython-312.pyc": "",
      "py/.venv/lib/site.py": "",
      "py/keep.log": "re-included by the nested .gitignore",
      "dist/.gitignore": "!keep.js\n",
      "dist/keep.js": "cannot be re-included: dist/ itself is excluded",
    });
  });

  afterAll(() => fixture.cleanup());

  it("lists tracked files, including dotfiles, as sorted posix paths", async () => {
    const { files } = await walkRepo(fixture.root);
    expect(files).toEqual([
      ".github/workflows/ci.yml",
      ".gitignore",
      "CLAUDE.md",
      "README.md",
      "package.json",
      "py/.gitignore",
      "py/app.py",
      "py/keep.log",
      "src/index.ts",
      "src/util.ts",
    ]);
  });

  it("applies root .gitignore rules", async () => {
    const { files } = await walkRepo(fixture.root);
    expect(files).not.toContain(".env");
    expect(files).not.toContain("src/debug.log");
    expect(files.some((f) => f.startsWith("dist/"))).toBe(false);
  });

  it("applies nested .gitignore rules relative to their directory", async () => {
    const { files } = await walkRepo(fixture.root);
    expect(files).not.toContain("py/generated/out.py");
  });

  it("lets a nested .gitignore re-include a file the root ignores", async () => {
    const { files } = await walkRepo(fixture.root);
    expect(files).toContain("py/keep.log");
  });

  it("never re-includes a file inside an excluded directory", async () => {
    const { files } = await walkRepo(fixture.root);
    expect(files).not.toContain("dist/keep.js");
  });

  it("always skips VCS, dependency and cache folders", async () => {
    const { files } = await walkRepo(fixture.root);
    for (const dir of [".git/", "node_modules/", "__pycache__/", ".venv/"]) {
      expect(files.some((f) => f.includes(dir))).toBe(false);
    }
  });

  it("returns the absolute root", async () => {
    const { root } = await walkRepo(fixture.root);
    expect(root).toBe(fixture.root);
  });
});

describe("walkRepo performance", () => {
  let fixture: Awaited<ReturnType<typeof createFixture>>;

  beforeAll(async () => {
    const files: Record<string, string> = { ".gitignore": "*.tmp\n" };
    for (let i = 0; i < 5000; i++) {
      files[`pkg${i % 50}/mod${Math.floor(i / 50) % 10}/file${i}.ts`] = "export {};\n";
    }
    fixture = await createFixture(files);
  }, 60_000);

  afterAll(() => fixture.cleanup());

  it("walks 5,000 files well under the 10 second budget", async () => {
    const started = performance.now();
    const { files } = await walkRepo(fixture.root);
    const elapsed = performance.now() - started;
    expect(files).toHaveLength(5001);
    expect(elapsed).toBeLessThan(2000);
  });
});
