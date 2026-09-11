# Task 06 — Local durability

| Field | Value |
| --- | --- |
| Status | complete |
| Depends on | 04 |
| Blocks | 08 |
| Parallelizable | yes, with 07 |
| Owner | Luna high — local durability |

## Deliverables

- Stable strict local-development origin.
- Browser persistence request and inspectable storage status.
- Non-destructive IndexedDB schema evolution foundation.
- Settings UI and bilingual copy explaining persistence and its browser boundary.
- Focused tests for persistence status and migration-safe behavior.

## Acceptance criteria

- Restarting the web server on the documented origin reveals the same data.
- The dev command never silently falls forward to a different port.
- Unsupported or denied persistent storage does not break the app.
- Existing addresses, snapshots, preferences, and exports remain compatible.
- No startup path clears user data.

## Implementation notes

- IndexedDB remains the source of truth; startup requests persistent storage and
  exposes the browser's granted/denied/unsupported state in Settings.
- The documented development origin is fixed to `http://localhost:5173` with a
  strict port. Schema changes are additive and imports validate before writes.
- A stalled IndexedDB open now times out with an actionable, non-destructive
  message rather than leaving the dashboard spinning forever.
