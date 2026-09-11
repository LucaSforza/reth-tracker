# Task 02 — Ethereum and local-data layer

| Field | Value |
| --- | --- |
| Status | planned |
| Depends on | 01 |
| Blocks | 04 |
| Parallelizable | yes, with 03 |
| Owner | Luna agent — data |

## Deliverables

- Read-only Ethereum service for balance, decimals, protocol conversion, block,
  and observation timestamp.
- IndexedDB repository for watched addresses, snapshots, RPC preference, export,
  import, and deletion.
- Pure reward-aggregation and display-conversion functions.
- Unit tests for the calculation rules and malformed data.

## Acceptance criteria

- No wallet or private key is requested.
- Raw amounts do not use floating-point arithmetic.
- RPC, contract, offline, and invalid-address errors become actionable domain errors.
- Duplicate rapid refreshes do not create noisy duplicate observations.

