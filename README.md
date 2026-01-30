# RETH-TRACKER

## Project Overview

reth-tracker enables monitoring of staking rewards for an Ethereum address using Rocket Pool ETH (rETH). It tracks the conversion rate of rETH to ETH directly from the protocol, reflecting the Ether accrued through staking rather than market price fluctuations.

## Features

- Accurate tracking of staking rewards over time  
- Historical record of staking returns  
- Real-time conversion rate of rETH to ETH from the protocol  

## Installation

```bash
cargo install reth-tracker
```

## Build

Install SQL first.

```
sudo apt install sqlite-devel
```

Then generate the Solidity bindings for the rETH token smart contract (source: [etherscan](https://etherscan.io/address/0xae78736Cd615f374D3085123A210448E74Fc6393#code)).

```bash
forge bind
```

To install forge, start from [here]("todo")

Afterwards, simply compile with [cargo]("todo").

```bash
cargo build
```

## Usage

To run reth-tracker, use the following command-line interface:

```bash
reth-tracker --help
```

Example usage:

Add an Ethereum address to watch:

```bash
reth-tracker add-watch-address -a 0xYourEthereumAddress
```

Update the stored staking rewards for all tracked addresses:

```bash
reth-tracker update
```

List all tracked addresses and their staking reward history:

```bash
reth-trackers list
```

