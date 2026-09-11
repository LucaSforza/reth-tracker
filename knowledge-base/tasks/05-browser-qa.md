# Task 05 — Browser QA

| Field | Value |
| --- | --- |
| Status | complete |
| Depends on | 04 |
| Blocks | release |
| Parallelizable | no |
| Owner | primary agent |

## QA matrix

- Desktop initial/empty state.
- Invalid address and unavailable RPC errors.
- Successful public-address lookup.
- Refresh and persistence after reload.
- Address removal and local-data export.
- Mobile viewport layout and keyboard navigation.
- Production build served beneath a repository-like base path.

## Exit criteria

All critical flows pass in the Codex browser. Findings and any deliberate MVP
limitations are recorded in this file before its status becomes `complete`.

## QA results — 2026-09-11

- Empty state rendered correctly with semantic headings, labeled inputs, and
  keyboard-addressable actions.
- Invalid address input produced the expected inline validation message.
- An invalid `ftp:` RPC preference was rejected with both a global actionable
  error and a settings notice.
- A live mainnet read using the user-provided address succeeded through the
  default public RPC. The UI showed a non-zero rETH balance, its protocol ETH
  value, the current on-chain rate, block number, and local observations. The full
  address and exact results are intentionally not copied into this repository.
- Reload preserved watched addresses, the selected address, RPC preference, and
  observation through IndexedDB.
- Backup export reached the application's success state. The Codex in-app
  browser did not expose its programmatic download as a download event, so the
  downloaded file itself could not be reopened during this pass.
- Desktop at 1440x900 and mobile at 360x800 rendered without broken controls.
  The history table intentionally scrolls horizontally on narrow screens.
- A repository-subpath production build emitted asset URLs beneath
  `/reth-tracker/`; it was also served at that mount path for the final pass.
- Address-removal controls were inspected but not invoked, to avoid deleting the
  locally stored live test observation.
- The English default, Italian switch, localized invalid-address message,
  dashboard section visibility controls, and persistence of those preferences
  after reload were verified against the production preview in the Codex browser.
- Mobile navigation was verified at 360×800; the menu exposes Dashboard,
  History, and Settings without breaking the compact layout. The final pass
  restored English and all dashboard sections.

## Remaining MVP limitations

- Closely spaced observations correctly report zero at the displayed precision;
  the reward chart gains meaning after refreshes at different protocol rates.
- The public default RPC can rate-limit or change its CORS policy.
- Complete lifetime and tax-lot accounting remain outside the MVP scope.
