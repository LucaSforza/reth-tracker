# Local durability and historical protocol yield

## Objective

Make local data reliably available on the originating device and add an
event-aware reconstruction of the Rocket Pool protocol yield earned by an
address since it first acquired rETH. No project-owned backend is introduced.

The binding requirements are recorded in
[`constraints/product-invariants.md`](../constraints/product-invariants.md).

## User outcome

1. Opening the app again from its stable origin restores all locally stored data.
2. Settings clearly report whether the browser granted durable storage and keep
   backup import/export available.
3. A user can start a historical synchronization for a watched address.
4. The app finds rETH movements, reconstructs held balances, reads historical
   protocol exchange rates, and displays cumulative protocol yield in ETH.
5. A stopped or failed synchronization can resume without discarding completed
   work or duplicating records.

## Protocol-yield definition

rETH is non-rebasing. Its protocol yield is represented by changes in the amount
of ETH backing one rETH. For every interval in which the address's rETH balance
is constant:

`interval yield = held rETH × (ending protocol rate − starting protocol rate)`

The lifetime figure is the sum of all such intervals beginning with the first
incoming rETH movement. Balance changes are boundaries, not yield. Negative rate
changes remain negative. Incoming transfers begin exposure and outgoing
transfers end exposure for the transferred quantity.

This metric intentionally excludes market price, purchase price, gas, fiat
conversion, and tax-lot accounting.

## Architecture

### Durable browser storage

- Keep IndexedDB as the local source of truth and upgrade its schema without
  clearing existing stores.
- Add storage-status detection and request `navigator.storage.persist()` where
  supported. Unsupported or denied persistence is a visible warning, not data
  loss or an application failure.
- Pin the local development server to one hostname and port with strict-port
  behavior and document the origin rule.
- Extend versioned JSON backup/import to include historical records and sync
  state. Validate the full candidate before modifying existing data.

### Historical chain reader

- Fetch canonical rETH ERC-20 `Transfer` logs where the tracked address is the
  sender or recipient, in provider-compatible block chunks.
- Merge and deduplicate logs by transaction hash and log index, then order by
  block number, transaction index, and log index.
- Reconstruct signed balance changes, including mint/burn transfers, using raw
  integer amounts.
- Query `getExchangeRate()` at balance-boundary blocks and at requested chart
  sample blocks. Historical `eth_call` requires an archive-capable RPC endpoint;
  detect and explain unsupported endpoints.
- Obtain actual block timestamps. Never substitute the local synchronization
  time for historical timestamps.

### Local historical model

Upgrade IndexedDB with stores for:

- normalized rETH transfer records;
- historical protocol-rate samples;
- per-address synchronization checkpoints and status;
- derived protocol-yield points when useful for fast rendering.

Writes must be idempotent. A resumed sync starts from its checkpoint while
re-reading a small finalized overlap so provider interruptions and short chain
reorganizations cannot create gaps or duplicates.

### Experience

- Add a “Ricostruisci storico” action for the selected address.
- Show progress, processed block range, cancellation/retry, and actionable RPC
  capability or rate-limit errors.
- Clearly distinguish “rendimento storico del protocollo” from the existing
  locally observed estimate.
- Once historical reconstruction completes, make the historical metric the
  primary cumulative-yield value and retain local observations as recent detail.
- Preserve the existing bilingual, responsive, keyboard-accessible interface.

## Execution plan

```text
06 Local durability ─────────┐
                             ├── 08 Integration and automated verification ── 09 Browser QA
07 Historical protocol yield ┘
```

- Task 06 and Task 07 may run in parallel.
- Task 08 starts only after both implementation branches are present in the
  shared worktree and owns cross-feature integration, migrations, import/export,
  copy, and automated verification.
- Task 09 is owned by the primary agent and uses the Codex browser. It cannot be
  delegated.

## Release gates

- Existing version-1 browser data survives the schema upgrade.
- Reload and server restart from the same fixed origin preserve all state.
- Historical synchronization is idempotent and resumes after interruption.
- Transfers do not count as yield; protocol-rate changes while held do.
- Large values remain precision-safe.
- Unsupported archive RPC behavior is explained without corrupting local data.
- Type checking, focused tests, production build, and Codex browser QA pass.
