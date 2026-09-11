# rETH Tracker knowledge base

This directory is the durable source of truth for the product. It deliberately
separates plans, which may evolve as work is completed, from constraints, which
all implementations and future plans must preserve.

## Plans

- [Browser MVP plan](plans/general-plan.md)
- [Local durability and historical protocol yield](plans/local-durability-and-historical-yield.md)
- [Implementation tasks](plans/tasks/)

Task statuses use: `planned`, `in-progress`, `blocked`, and `complete`.

## Constraints

- [Product invariants](constraints/product-invariants.md)

When a plan conflicts with a constraint, the constraint wins. Any proposed
change to a constraint must be recorded explicitly before implementation.
