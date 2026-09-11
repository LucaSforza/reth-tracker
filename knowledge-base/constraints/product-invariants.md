# Product invariants

These constraints define behavior that must remain true across releases. They
are acceptance criteria for every implementation plan, migration, and QA pass.

## Local ownership and durable access

User data belongs to the browser on the device that first opened the web app.
The app must not require a project-owned backend, login, wallet connection,
private key, cookie, or remote database to save or reload that data.

For the same browser profile, device, and stable application origin, all watched
addresses, observations, historical synchronization results, preferences, and
sync progress must remain accessible after:

- page reloads and browser restarts;
- stopping and restarting the local web server;
- application upgrades and IndexedDB schema migrations;
- interrupted or partially completed historical synchronizations.

The application must use a stable origin in documented local-development and
production flows. Development must fail rather than silently switch to another
port, because scheme, hostname, and port identify a different browser storage
area. The application must request persistent browser storage when the platform
supports it and expose whether persistence was granted.

The app must never clear or replace existing local data during startup,
migration, refresh, or synchronization. Destructive deletion must require an
explicit user action. Import must be validated before replacing current data,
and migrations must be covered by tests.

Browser storage is ultimately controlled by the user and operating system.
Explicitly clearing site/browser data, deleting the browser profile, changing
device or browser profile, or opening the app under a different origin can make
the original storage unavailable. The UI and documentation must state this
boundary and keep export/import available as a user-controlled backup.

## Privacy and network boundary

All application state is stored locally. Only public blockchain read requests
may leave the device through the RPC endpoint selected by the user. The RPC
provider can observe requested addresses, blocks, and contract calls. No secret
or RPC credential may be committed or embedded in a public build.

## Historical metric scope

The historical feature reports only Rocket Pool protocol yield: the increase or
decrease in ETH backing that accrued while the tracked wallet held rETH.

It must not present the result as trading profit, market-price performance, tax
cost basis, or total portfolio return. It does not need to decode DEX purchase
prices, fiat prices, gas expenditure, or unrelated ETH transfers.

All persisted blockchain quantities and calculations must use integer base units
(`bigint` in memory and canonical decimal strings at storage boundaries), never
floating-point arithmetic.
