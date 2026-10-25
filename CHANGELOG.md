# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Liamhetherington/ai-readiness-scanner/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Liamhetherington/ai-readiness-scanner/releases/tag/v0.1.0
