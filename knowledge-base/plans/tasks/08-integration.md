# Task 08 — Integration and automated verification

| Field | Value |
| --- | --- |
| Status | complete |
| Depends on | 06, 07 |
| Blocks | 09 |
| Parallelizable | no |
| Owner | Luna high — integration |

## Deliverables

- Wire historical synchronization and persistence status into the application.
- Complete IndexedDB migration, versioned import/export, UI state, progress,
  cancellation/retry, and bilingual copy across both preceding tasks.
- Resolve overlapping contracts and remove obsolete locally-observed claims
  where a completed historical result is available.
- Add integration tests and update README/knowledge-base completion notes.

## Acceptance criteria

- Existing data loads after migration and new historical data survives reload.
- Import/export round-trips both legacy and new records safely.
- A historical sync can complete, fail safely, and resume without duplication.
- The cumulative metric is explicitly protocol yield, never financial profit.
- Type checking, all focused tests, and production build pass.

## Verification

- `npm run typecheck` passes.
- `npm test -- --run src/web` passes 9 suites / 34 tests, including repository
  migration/import, persistence, historical calculation, reader, and resume
  coverage.
- `npm run build` passes for the root deployment and
  `VITE_BASE_PATH=/reth-tracker/ npm run build` emits correctly prefixed asset
  URLs.
