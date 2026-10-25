# Agent guide for invoice-service

This is a TypeScript service that turns time entries into invoices.

## Commands
- Install: `npm ci`
- Test: `npm test` (vitest). Run it before every commit.
- Lint and format: `npm run lint` and `npm run format`.

## Layout
- `src/` holds the domain code. Each module exports pure functions.
- `tests/` mirrors `src/` one test file per module.
- Architecture decisions live in `docs/adr/`.

## Conventions
- TypeScript strict mode, no `any`.
- Money is stored as integer cents.
