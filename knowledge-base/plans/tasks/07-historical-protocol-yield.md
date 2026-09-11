# Task 07 — Historical protocol yield

| Field | Value |
| --- | --- |
| Status | complete |
| Depends on | 04 |
| Blocks | 08 |
| Parallelizable | yes, with 06 |
| Owner | Luna high — historical data |

## Deliverables

- Historical rETH transfer reader with chunking, ordering, and deduplication.
- Archive-RPC historical rate reader and actionable capability failures.
- Pure event-aware balance and protocol-yield calculation.
- Persisted transfer/rate/checkpoint domain contracts and repository operations.
- Unit tests for incoming/outgoing transfers, mint/burn, partial disposal,
  negative rate movement, precision, deduplication, and resume checkpoints.

## Acceptance criteria

- The first incoming rETH movement establishes the beginning of exposure.
- Transfers change exposure but are never counted as yield.
- Yield is calculated only from rate changes while a balance is held.
- Re-running the same range creates no duplicate records or reward.
- Interrupted range synchronization can resume from stored progress.
- Historical timestamps come from blocks and quantities never use `number` or
  `f64` for arithmetic.

## Implementation notes

- Transfer logs are chunked, deduplicated, ordered by block/transaction/log,
  and persisted with resumable checkpoints.
- Protocol-rate intervals are calculated with bigint quantities only. Incoming,
  outgoing, mint, and burn movements change exposure; only rate movement while
  rETH is held contributes to the reported ETH yield.
