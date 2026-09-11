# rETH Tracker

Browser-first tracker for the protocol value and locally observed staking
rewards of Rocket Pool ETH (rETH). The web application is a static Vite build:
it can run from a local machine or from GitHub Pages without a server.

## Web MVP (English)

The app reads an address's public ETH/rETH balances and the Rocket Pool
rETH-to-ETH rate through a JSON-RPC endpoint. It stores watched addresses,
observations, the selected RPC URL, and preferences in the browser's
IndexedDB. No wallet connection, login, signature, cookie, private key, or
backend account is needed.

The reward number is a **local observation estimate**, not a complete lifetime
earnings or tax statement. Between two observations it estimates the change in
protocol value using the previous rETH balance and the change in the protocol
rate. Deposits, withdrawals, transfers between observations, a changing RPC
endpoint, and missed observations can make the estimate differ from actual
cash-flow-adjusted returns. Full ERC-20 transfer history is outside this MVP.

### Run locally

Install Node.js 22 or newer, then from the repository root:

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The default RPC endpoint is public and may be
rate-limited. A compatible HTTPS Ethereum JSON-RPC URL can be selected in the
app's settings; API keys must not be committed to this repository.

### Check and build

```bash
npm run typecheck
npm test -- --run src/web
npm run build
npm run preview
```

The production files are written to `dist/` (ignored by Git). To build for a
repository hosted beneath a GitHub Pages subpath, set the Vite base path:

```bash
VITE_BASE_PATH=/your-repository-name/ npm run build
```

The included [Pages workflow](.github/workflows/pages.yml) sets this value to
`/<repository-name>/` automatically, runs the checks, and publishes `dist/`.
Enable GitHub Pages for the repository using **GitHub Actions** as the source.

### Privacy and data management

Address data and observations remain in the browser's local IndexedDB. The
chosen RPC provider receives the address and read requests needed to answer
queries, so provider privacy policies and logs still apply. The app does not
send data to a project server. Clearing site data removes the local history;
use the in-app export before clearing if you need a backup. Exported JSON files
contain public addresses and observations, but may still reveal portfolio
history and should be handled accordingly.

## Browser preferences

The interface defaults to English and can be switched to Italian from Settings.
The same panel lets users choose whether the position overview, value chart, and
observation history are visible. Language and visibility choices are stored in
the browser's existing local IndexedDB repository and are included in JSON
backups.

## CLI Rust / Foundry (legacy)

The repository also contains the legacy Rust CLI and Solidity contracts. Building
them requires Rust/Cargo, Foundry, and SQLite development headers:

```bash
forge bind
cargo build
cargo test --package reth-tracker
```

The CLI is available with `cargo run --bin main -- --help`. The web app is the
primary MVP product; the CLI does not share the browser's IndexedDB storage.
