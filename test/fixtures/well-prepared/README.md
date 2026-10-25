# invoice-service

invoice-service turns tracked time entries into invoices. It groups entries by client and project, applies
hourly rates and discounts, calculates tax for the client's region and renders a document that can be sent
by email or exported to the accounting system. The service is small on purpose: every module is a set of
pure functions, so the behaviour is easy to test and easy for people and coding agents to change safely.

## Installation

You need Node.js 20 or newer. Clone the repository and install the exact dependency versions from the lock
file with the command below. No global tools are required, and the project does not need a database for
local development because the sample data in the fixtures folder is loaded into memory.

```
npm ci
```

## Usage

Start the development server, which watches the source folder and reloads on change. The server listens on
port 3000 and exposes a single endpoint that accepts a list of time entries and returns the invoice as JSON.

```
npm run dev
```

## Testing

The test suite uses vitest. Every module in the source folder has a matching test file. Run the whole suite
with the command below; continuous integration runs the same command on every pull request, together with
the linter and the formatter check, and a pull request cannot merge until all three pass.

```
npm test
```

## Project layout

The source folder contains the domain modules: rates, tax, grouping and rendering. The tests folder mirrors
it. Longer explanations of the design live in the docs folder, and significant decisions are recorded as
architecture decision records so that future contributors understand why the code is shaped the way it is.

## Contributing

Open an issue describing the change first. Keep pull requests small, add tests for new behaviour, and update
the agent guide when commands or conventions change. Formatting is enforced by prettier and linting by eslint.
