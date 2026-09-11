# Browser MVP — general plan

## Objective

Turn the current Rust CLI into a privacy-friendly static web application that
tracks the protocol value of rETH for any public Ethereum address. The finished
site must run entirely in the browser and be deployable to GitHub Pages.

## MVP experience

1. A visitor enters an Ethereum address; connecting a wallet is not required.
2. The application reads the address's rETH balance and the protocol's rETH/ETH
   exchange rate directly from Ethereum JSON-RPC.
3. It displays current rETH, protocol value in ETH, protocol yield, rate, and
   last refresh time.
4. Each successful refresh creates at most one local observation for that
   address and time bucket.
5. The browser stores watched addresses, observations, preferences, and the
   selected RPC URL. Users can export and import this local data as JSON.
6. A chart shows protocol value over time. Before a historical synchronization,
   it falls back to locally captured observations.
7. An archive-capable RPC can reconstruct event-aware protocol yield from the
   first incoming rETH transfer through the latest finalized block.

## Product boundary

Before historical synchronization, the app reports a local observation
estimate. For consecutive observations, reward accrual is estimated as:

`previous rETH balance × (current protocol rate − previous protocol rate)`

Historical synchronization replaces that cumulative estimate with protocol
yield reconstructed from rETH `Transfer` boundaries and historical protocol
rates. Transfers change exposure and are never counted as yield. The metric is
not market profit, purchase-price performance, tax basis, or gas-adjusted return.

## Architecture

- React + TypeScript + Vite static single-page application.
- `viem` for Ethereum address validation and read-only JSON-RPC contract calls.
- IndexedDB behind a small repository abstraction for local persistence.
- No server, authentication, cookies, wallet signature, or private keys.
- Hash-based routing / query state and relative build assets so GitHub Pages can
  host the output under a repository subpath.
- A configurable public RPC endpoint. No secret API key is bundled into the app.
- Raw blockchain amounts remain `bigint`; decimal conversion is performed only
  for display and chart points.

## Static deployment

The production build writes to `dist/`. GitHub Actions publishes that directory
to GitHub Pages. Vite's base path is derived from the repository name in CI and
can be overridden through `VITE_BASE_PATH`.

## Quality bar

- Responsive on desktop and mobile.
- Keyboard accessible controls, semantic landmarks, visible focus states, and
  useful loading/error/empty states.
- Unit tests for reward calculation, formatting, persistence-relevant parsing,
  and address/RPC validation.
- `npm run typecheck`, `npm test`, and `npm run build` must pass.
- Final manual QA is performed in the Codex browser against the production build.

## Execution order

```text
01 Foundation
   ├── 02 Ethereum/data layer ─┐
   ├── 03 Dashboard UI ────────┼── 04 Integration/tests/deployment ── 05 Browser QA
   └───────────────────────────┘
```

Tasks 02 and 03 are intentionally parallel. Task 04 integrates their contracts;
task 05 begins only after the production build succeeds.

## Later work

- Historical reconstruction from rETH `Transfer` events and archive-node rate
  queries moved into the active
  [local durability and historical yield plan](local-durability-and-historical-yield.md).
- Cross-device synchronization and scheduled background refresh.
- Fiat pricing, tax lots, multi-chain or DeFi-position discovery.
