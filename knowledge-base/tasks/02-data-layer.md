# Task 02 — Ethereum and local-data layer

| Field | Value |
| --- | --- |
| Status | completed |
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

## Implementation notes

- `ViemEthereumReader` performs read-only mainnet calls against the canonical
  rETH contract (`0xae78736Cd615f374D3085123A210448E74Fc6393`) and pins all
  values to one block. It reads rETH decimals, balances, protocol conversion,
  exchange rate, block number, and block timestamp without requesting a wallet.
- `IndexedDbTrackerRepository` stores addresses, observations, preferences, and
  import/export data locally. Snapshot keys use one-minute address/time buckets,
  so repeated refreshes replace the existing observation instead of creating
  duplicates.
- Raw amounts remain canonical decimal strings at the persistence boundary and
  are parsed to `bigint` for reward calculations and display formatting; no
  floating-point conversion is used.
- Domain errors classify invalid addresses/RPC URLs, offline RPC, contract/RPC
  failures, storage failures, and malformed imports for actionable UI states.
- Tests cover reward aggregation, negative rate changes, precision-safe display,
  percentages, address validation, and malformed imported values. IndexedDB
  integration remains covered by the repository abstraction and can be expanded
  with a fake IndexedDB adapter when that dependency is added.
