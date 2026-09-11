# Task 04 — Integration, tests, deployment, and documentation

| Field | Value |
| --- | --- |
| Status | complete |
| Depends on | 02, 03 |
| Blocks | 05 |
| Parallelizable | partly; starts after integration contracts stabilize |
| Owner | Luna agent — quality, then primary agent integration |

## Deliverables

- Integrated application state and data/UI wiring.
- Automated tests and accessibility-oriented smoke coverage.
- GitHub Pages workflow.
- Updated root README with local-development and deployment instructions.

## Acceptance criteria

- Type checking, tests, and production build pass.
- Refresh and persistence work across a page reload.
- GitHub Pages output uses correct relative/subpath assets.
- Documentation clearly states privacy and RPC limitations.

## Subtask — Luna quality/deployment handoff

This subtask owns the independent release scaffolding and documentation. It is
complete only when the primary agent has integrated Tasks 02 and 03 and the
browser QA in Task 05 has passed.

### Delivered in this subtask

- `.github/workflows/pages.yml` builds the Vite app, runs type checking and
  tests, derives `VITE_BASE_PATH` from the repository name, uploads `dist/`,
  and deploys it through the official GitHub Pages actions.
- `README.md` documents local development, checks, production builds,
  repository-subpath deployment, browser-only privacy, RPC limitations, and
  the distinction between local observations and complete earnings.

### Verification owned by primary integration

The workflow assumes the final frontend contracts and tests from Tasks 02/03.
Run `npm install`, `npm run typecheck`, `npm test -- --run src/web`, and
`npm run build` after integration. The `src/web` filter intentionally keeps
vendored OpenZeppelin JavaScript tests (which require a separate Truffle
toolchain) out of the browser MVP check. Then follow the QA matrix in
`05-browser-qa.md`, including serving `dist/` beneath a repository-like
base path. Do not mark this task complete until those checks and the manual
Codex browser pass are recorded.

## Integration completion

- The React dashboard now loads and mutates the IndexedDB repository instead of
  using fixture data.
- Adding or refreshing an address performs a pinned-block mainnet read and saves
  the observation locally.
- The displayed reward uses the bigint protocol-rate aggregation rather than a
  raw portfolio-value delta.
- `npm run typecheck`, all 14 scoped web tests, the root production build, and a
  build with `VITE_BASE_PATH=/reth-tracker/` pass.
- The only build notice is Vite's advisory 500 kB chunk-size warning; the main
  minified bundle is about 523 kB (about 162 kB gzip).
