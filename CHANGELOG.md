# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-24

Milestone 2: checks and scoring.

### Added

- 17 checks across five categories, totalling 100 points:
  - Agent context (20): a context file is present (`CLAUDE.md`, `AGENTS.md`,
    `.cursorrules` or `.github/copilot-instructions.md`) and has over 200
    characters.
  - Testing (25): test files exist, a test command is defined, the test to
    source file ratio, and whether CI runs the tests.
  - Type safety and linting (15): strict TypeScript or a Python type checker
    (falling back to type hint coverage), a linter config and a formatter
    config. Each language present is scored and averaged.
  - Documentation (20): README presence, length and coverage of setup, running
    and testing; a `docs/` folder; architecture decision records.
  - Code structure (20): files over 500 lines, average file length and folder
    nesting depth.
- Every check returns an id, category, pass/fail, points earned and possible, a
  one-sentence finding and a one-sentence fix.
- Scoring with per-category totals and top fixes ranked by points gained.
  Checks that share the same fix are merged into one suggestion.
- Source and test file classification for JavaScript/TypeScript and Python
  that skips fixtures, vendored, generated, minified and config files.
- Three fixture repositories (well-prepared, average and poor) with tests that
  pin their score ranges.
- The CLI prints the score, category totals and top fixes.

### Performance

- Scores a 5,000-file repository in well under a second.

## [0.1.0] - 2026-10-24

Milestone 1: scaffold.

### Added

- `ai-readiness [path]` command line entry point with `--format`, `--out` and
  `--llm` options, and clear errors for unknown formats and missing folders.
- File walker that respects `.gitignore` files, including nested ones, with
  git's precedence rules: a deeper `!pattern` can re-include a file, but
  nothing re-includes a file inside an excluded folder.
- Dependency, cache and VCS folders (`node_modules`, `.git`, `.venv`,
  `__pycache__` and similar) are skipped while walking, for speed.
- Runs on Node.js 20 and newer, and through `npx`.
- MIT license.

[Unreleased]: https://github.com/Liamhetherington/ai-readiness-scanner/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Liamhetherington/ai-readiness-scanner/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Liamhetherington/ai-readiness-scanner/releases/tag/v0.1.0
