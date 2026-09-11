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

Before historical synchronization, the reward number is a **local observation
estimate** based on the previous rETH balance and the protocol-rate change.
“Reconstruct history” instead reads the address's rETH transfer history and the
historical protocol rate, then calculates only the ETH backing accrued while the
address held rETH. Transfers change exposure and are not counted as yield.

Historical reconstruction requires an archive-capable Ethereum mainnet RPC. It
is protocol yield, not market profit, purchase-price performance, tax basis, or
a gas-adjusted return.

### Run locally

Install Node.js 22 or newer, then from the repository root:

```bash
npm install
npm run dev
```

Open exactly `http://localhost:5173`. The development server uses a fixed host
and port and fails if that address is already occupied. This matters because the
browser keeps a separate IndexedDB database for every scheme, hostname, and
port; changing any of them opens a different local store.

The default RPC endpoint is public and may be rate-limited. A compatible HTTPS
Ethereum JSON-RPC URL can be selected in the
app's settings; API keys must not be committed to this repository.

### Check and build

```bash
npm run typecheck
npm test -- --run src/web
npm run build
npm run preview
```

The production preview is always available at `http://localhost:4173` and also
uses a strict port. It has a different browser storage origin from the
development server by design; use one consistently for persistent local data.

The production files are written to `dist/` (ignored by Git). To build for a
repository hosted beneath a GitHub Pages subpath, set the Vite base path:

```bash
VITE_BASE_PATH=/your-repository-name/ npm run build
```

The included [Pages workflow](.github/workflows/pages.yml) sets this value to
`/<repository-name>/` automatically, runs the checks, and publishes `dist/`.
Enable GitHub Pages for the repository using **GitHub Actions** as the source.

### Privacy and data management

Address data, observations, historical transfers, rates, and synchronization
progress remain in the browser's local IndexedDB. The
chosen RPC provider receives the address and read requests needed to answer
queries, so provider privacy policies and logs still apply. The app does not
send data to a project server. Clearing site data removes the local history;
use the in-app export before clearing if you need a backup. Exported JSON files
contain public addresses and observations, but may still reveal portfolio
history and should be handled accordingly.

The app asks supported browsers to protect this origin's storage from automatic
eviction and reports the result in Settings. Data remains associated with the
same device, browser profile, and exact site origin. Clearing the browser
profile/site data, using another origin, or moving to another device still
requires a JSON backup and import.

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
