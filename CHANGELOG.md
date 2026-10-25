# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-10-24

Milestone 3: reports.

### Added

- Terminal report with the overall score and rating, a bar for each category,
  and the top five fixes ranked by points gained. Long fixes wrap to the
  terminal width.
- Colour in the terminal report, following the TTY and the `NO_COLOR` and
  `FORCE_COLOR` conventions.
- Markdown report (`--format md`) with the summary plus every check, grouped by
  category, showing status, points, finding and fix.
- JSON report (`--format json`) with the full structured result and a
  `schemaVersion` field so CI consumers can detect breaking changes.
- `--out <file>` writes any format to a file, creating parent folders, and
  confirms on stderr so stdout stays clean. Files never contain colour codes.
- Ratings: "Ready for AI agents" (80 and above), "Partly ready" (50 to 79) and
  "Not ready" (below 50).
- A human-readable `title` on every check and check result.

### Fixed

- The large-file finding now says "1 of N source files is" instead of "are".
- The CLI exits quietly instead of crashing when its output pipe is closed
  early, for example `ai-readiness . | head`.

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

[Unreleased]: https://github.com/Liamhetherington/ai-readiness-scanner/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Liamhetherington/ai-readiness-scanner/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Liamhetherington/ai-readiness-scanner/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Liamhetherington/ai-readiness-scanner/releases/tag/v0.1.0
