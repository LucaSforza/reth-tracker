# Task 01 — Application foundation

| Field | Value |
| --- | --- |
| Status | complete |
| Depends on | none |
| Blocks | 02, 03, 04 |
| Parallelizable | no |
| Owner | primary agent |

## Deliverables

- Vite React TypeScript project alongside the existing Rust/Foundry source.
- Scripts for development, tests, type checking, and production builds.
- Shared domain types and stable interfaces between data and presentation.
- GitHub Pages-compatible Vite configuration.

## Acceptance criteria

- The empty application starts and builds.
- Existing Rust and Solidity sources remain intact.
- Generated frontend output is ignored by Git.

## Completion notes

The React/Vite/TypeScript shell, shared domain contracts, GitHub Pages base-path
configuration, test bootstrap, and npm dependency lockfile were added on the
`codex/web-mvp` branch.
