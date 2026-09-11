# Task 03 — Dashboard experience

| Field | Value |
| --- | --- |
| Status | completed |
| Depends on | 01 |
| Blocks | 04 |
| Parallelizable | yes, with 02 |
| Owner | Luna agent — UI |

## Deliverables

- Responsive single-page dashboard and visual design system.
- Address entry, watched-address selection, refresh, empty/loading/error states.
- Summary metrics, rewards explanation, observation chart, and history table.
- Settings/data-management surface for RPC, import, export, and clear-data actions.

## Acceptance criteria

- The interface works from 360 px mobile width through desktop.
- Controls are keyboard accessible and have visible focus treatment.
- Yield estimates are never presented as complete lifetime or tax-ready earnings.
- Components consume the shared domain interfaces and can render fixture data.

## Implementation notes

- Implemented `Dashboard` as a controlled React component with optional callbacks, plus a standalone `App` fixture so the UI can be previewed before the repository/data layer is wired in.
- Added responsive Italian UI in `src/web/styles.css`: address entry and selection, summary cards, observed-yield disclosure, empty/loading/error states, SVG observation chart, history table, and collapsible settings/data-management panel.
- The UI formats wei values with `BigInt` and deliberately labels changes as observed growth rather than lifetime or tax-ready earnings.
- The chart is dependency-free SVG and supports keyboard focus/hover on data points. Settings supports RPC editing, JSON import/export hooks, and clear-data callback.
- `npm run typecheck` reaches the dashboard without errors; the repository currently has pre-existing type errors in `src/web/data/ethereum.ts` (`viem` version/API mismatch).
