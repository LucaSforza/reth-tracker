# Repository Guidelines

## Project Structure & Module Organization

This repository combines a Rust CLI with Solidity sources used to generate contract bindings. The CLI entry point is `src/bin/main.rs`. Rocket Pool contracts live under `src/contracts/`, while their supporting interfaces are grouped by domain under `src/interface/`. Foundry configuration is in `foundry.toml`, with import aliases in `remappings.txt`; third-party Solidity dependencies are vendored in `lib/`. `out/`, `cache/`, and `target/` are generated build directories and should not be edited by hand. In particular, `out/bindings` is regenerated from the Solidity contracts.

## Build, Test, and Development Commands

- `forge build` compiles the Solidity contracts and produces artifacts in `out/`.
- `forge bind` regenerates the Rust crate in `out/bindings`; run it after ABI changes.
- `cargo build` compiles the `reth-tracker` Rust package and its generated bindings.
- `cargo run --bin main -- --help` runs the CLI locally and lists available commands.
- `cargo test --package reth-tracker` runs Rust tests.
- `forge test -vvv` runs Solidity tests with verbose traces.
- `cargo fmt --package reth-tracker -- --check` and `forge fmt --check` verify formatting. CI currently runs the Foundry format, build, and test checks.

Install Foundry and the system SQLite development package before building. Keep `Cargo.lock` and `foundry.lock` synchronized with dependency changes.

## Coding Style & Naming Conventions

Use standard `rustfmt` output (four-space indentation), `snake_case` for Rust functions and modules, and `PascalCase` for types and Clap subcommands. Prefer `Result` propagation with `?` over new `unwrap` calls. Solidity remains pinned to `0.7.6`; preserve established contract/interface names such as `RocketTokenRETH`, use `camelCase` functions, and format with `forge fmt`. Do not reformat or modify vendored files in `lib/` unless intentionally updating a dependency.

## Testing Guidelines

No first-party tests exist yet. Add Rust integration tests as `tests/<feature>.rs` or focused unit tests beside the code. Add Foundry tests as `test/<ContractName>.t.sol`, naming test functions `test_<behavior>` and revert cases `test_RevertWhen_<condition>`. Cover database behavior with temporary files and mock or pin RPC-dependent behavior; tests should not rely on live mainnet availability.

## Commit & Pull Request Guidelines

Recent history uses short, informal subjects such as `refined README` and `exploring the blockchain`; keep commits focused and describe the observable change. Pull requests should explain motivation, summarize Rust and Solidity impacts, list commands run, and link relevant issues. Call out ABI or schema changes explicitly and include CLI output when user-facing behavior changes. Never commit `.env`, RPC credentials, local SQLite data, or generated build directories.
