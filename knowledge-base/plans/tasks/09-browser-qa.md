# Task 09 — Codex browser QA

| Field | Value |
| --- | --- |
| Status | complete |
| Depends on | 08 |
| Blocks | release |
| Parallelizable | no |
| Owner | primary agent; must not be delegated |

## QA matrix

- Existing local data survives upgrade, reload, and a local server restart on
  the fixed origin.
- Persistence status is understandable for granted, denied, and unsupported
  browser capabilities.
- Historical sync exposes progress and leaves local state usable on RPC error.
- Successful historical reconstruction updates the protocol-yield metric and
  timeline without counting transfers as yield.
- Re-running and resuming synchronization does not duplicate data.
- Export/import preserves the complete upgraded state.
- English and Italian, desktop and mobile, keyboard navigation, empty/loading/
  error/success states, and repository-subpath production assets are verified.

## Exit criteria

The primary agent records results and any accepted limitations here only after
the integrated production build has passed in the Codex browser.

## QA results — 2026-09-12

- Production preview at `http://localhost:4173/` rendered the dashboard and
  settings without console errors. Invalid address input produced the expected
  localized validation message.
- On a clean local origin (`http://127.0.0.1:4173/`), the app completed startup,
  the Italian switch worked, and the preference remained Italian after reload.
- Settings visibly explains the browser/profile/origin boundary and reports the
  current persistent-storage capability. Mobile visual inspection at the
  requested compact width kept the address form, empty state, and settings
  controls usable.
- A repository-like production build emitted `/reth-tracker/assets/...` URLs;
  the root build was restored before leaving the preview server running.
- The existing Codex `localhost:4173` profile contains a stalled IndexedDB open
  from an earlier session. The app now times out non-destructively with a retry
  message and does not clear that data. A clean origin was used for the
  interactive persistence checks; no local data was deleted during QA.
