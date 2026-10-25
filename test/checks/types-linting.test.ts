import { describe, expect, it } from "vitest";
import { formatterConfig, linterConfig, pythonHintRatio, strictTypes } from "../../src/checks/types-linting.js";
import { runCheck } from "../helpers/context.js";

const ts = { "src/index.ts": "export {};" };
const py = { "app/main.py": "def f():\n    pass\n" };

describe("types-strict (JS/TS)", () => {
  it("passes with strict mode, even in a tsconfig with comments", async () => {
    const r = await runCheck(strictTypes, { ...ts, "tsconfig.json": '{\n // c\n "compilerOptions": { "strict": true, },\n}' });
    expect(r.passed).toBe(true);
  });

  it("follows a relative extends", async () => {
    const r = await runCheck(strictTypes, {
      ...ts,
      "tsconfig.json": '{ "extends": "./config/base" }',
      "config/base.json": '{ "compilerOptions": { "strict": true } }',
    });
    expect(r.passed).toBe(true);
  });

  it("lets a local strict: false override a strict base", async () => {
    const r = await runCheck(strictTypes, {
      ...ts,
      "tsconfig.json": '{ "extends": "./base.json", "compilerOptions": { "strict": false } }',
      "base.json": '{ "compilerOptions": { "strict": true } }',
    });
    expect(r.earned).toBe(2);
  });

  it("treats a strict shared preset as strict", async () => {
    expect((await runCheck(strictTypes, { ...ts, "tsconfig.json": '{ "extends": "@tsconfig/strictest" }' })).passed).toBe(true);
  });

  it("gives partial credit for a non-strict tsconfig and none without one", async () => {
    expect((await runCheck(strictTypes, { ...ts, "tsconfig.json": "{}" })).earned).toBe(2);
    const none = await runCheck(strictTypes, ts);
    expect(none.earned).toBe(0);
    expect(none.fix).toBe('Turn on "strict": true in tsconfig.json.');
  });

  it("finds per-package tsconfigs in a monorepo", async () => {
    const r = await runCheck(strictTypes, {
      "packages/a/src/x.ts": "",
      "packages/a/tsconfig.json": '{ "compilerOptions": { "strict": true } }',
      "packages/b/tsconfig.json": "{}",
    });
    expect(r.earned).toBe(4);
  });
});

describe("types-strict (Python)", () => {
  it.each([
    ["mypy.ini", "[mypy]\n"],
    ["pyproject.toml", "[tool.mypy]\nstrict = true\n"],
    ["pyproject.toml", "[tool.pyright]\n"],
    ["pyrightconfig.json", "{}"],
    ["setup.cfg", "[mypy]\n"],
  ])("passes with %s", async (file, content) => {
    expect((await runCheck(strictTypes, { ...py, [file]: content })).passed).toBe(true);
  });

  it("scores type hint coverage when there is no checker config", async () => {
    const hinted = "def a(x: int) -> int:\n    return x\n\ndef b(self, y: str):\n    pass\n\ndef c() -> None:\n    pass\n";
    expect((await runCheck(strictTypes, { "a.py": hinted })).earned).toBe(4);
    const r = await runCheck(strictTypes, py);
    expect(r.earned).toBe(0);
    expect(r.fix).toMatch(/^Add a \[tool\.mypy\]/);
    expect(r.fix).not.toContain("tsconfig");
  });

  it("averages across languages and lists fixes only for those that fall short", async () => {
    const r = await runCheck(strictTypes, { ...ts, ...py, "tsconfig.json": '{"compilerOptions":{"strict":true}}' });
    expect(r.earned).toBe(3);
    expect(r.fix).not.toContain("tsconfig");
    expect(r.fix).toContain("mypy");
  });

  it("earns nothing when there is no source code", async () => {
    expect((await runCheck(strictTypes, { "README.md": "" })).earned).toBe(0);
  });
});

describe("pythonHintRatio", () => {
  it("counts parameter or return annotations, ignoring self and cls", () => {
    const src = [
      "def a(x: int): pass",
      "def b(self): pass",
      "async def c() -> str: pass",
      "def d(\n    x,\n    y: int,\n): pass",
      "  def e(cls, other): pass",
    ].join("\n");
    expect(pythonHintRatio([src])).toEqual({ annotated: 3, total: 5 });
  });
});

describe("types-linter", () => {
  it.each([
    ["eslint.config.js", "export default []"],
    ["eslint.config.mjs", "export default []"],
    [".eslintrc.json", "{}"],
    ["biome.json", "{}"],
    ["package.json", '{"eslintConfig":{"extends":"x"}}'],
  ])("passes JS/TS with %s", async (file, content) => {
    expect((await runCheck(linterConfig, { ...ts, [file]: content })).passed).toBe(true);
  });

  it.each([
    ["ruff.toml", ""],
    [".flake8", "[flake8]\n"],
    ["pyproject.toml", "[tool.ruff.lint]\nselect=['E']\n"],
    ["setup.cfg", "[flake8]\n"],
    ["tox.ini", "[flake8]\n"],
    [".pylintrc", ""],
  ])("passes Python with %s", async (file, content) => {
    expect((await runCheck(linterConfig, { ...py, [file]: content })).passed).toBe(true);
  });

  it("does not credit a JS linter for a Python-only repo", async () => {
    const r = await runCheck(linterConfig, { ...py, "eslint.config.js": "" });
    expect(r.earned).toBe(0);
    expect(r.fix).toContain("ruff");
  });

  it("gives half credit when only one of two languages is linted", async () => {
    const r = await runCheck(linterConfig, { ...ts, ...py, "eslint.config.js": "" });
    expect(r.earned).toBe(3);
  });
});

describe("types-formatter", () => {
  it.each([
    [".prettierrc", "{}"],
    [".prettierrc.json", "{}"],
    ["prettier.config.js", ""],
    ["package.json", '{"prettier":{}}'],
    ["biome.json", "{}"],
  ])("passes JS/TS with %s", async (file, content) => {
    expect((await runCheck(formatterConfig, { ...ts, [file]: content })).passed).toBe(true);
  });

  it.each([
    ["pyproject.toml", "[tool.black]\n"],
    ["pyproject.toml", "[tool.ruff.format]\nquote-style='double'\n"],
    ["ruff.toml", "[format]\n"],
    [".pre-commit-config.yaml", "repos:\n  - hooks:\n      - id: ruff-format\n"],
  ])("passes Python with %s", async (file, content) => {
    expect((await runCheck(formatterConfig, { ...py, [file]: content })).passed).toBe(true);
  });

  it("does not treat a lint-only ruff config as a formatter", async () => {
    expect((await runCheck(formatterConfig, { ...py, "pyproject.toml": "[tool.ruff.lint]\n" })).earned).toBe(0);
  });
});
