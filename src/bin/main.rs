use std::process::exit;
use std::str::FromStr;

use alloy::eips::BlockId;
use alloy::network::Network;
use alloy::providers::Provider;
use alloy::{primitives::Address, providers::ProviderBuilder, transports::http::reqwest::Url};
use anyhow::Result;
use chrono::{DateTime, Utc};
use clap::{arg, command, Parser, Subcommand};
use reth_lib::rocket_token_reth::RocketTokenRETH;

use rusqlite::Connection;
use std::env;
use std::path::PathBuf;

/// Retrieves or creates the SQLite database connection and ensures required tables exist.
///
/// # Returns
/// A `rusqlite::Result` containing the database `Connection`.
fn get_db() -> rusqlite::Result<Connection> {
    // Recupera la variabile HOME
    let home = env::var("HOME").expect("HOME non trovata. Sei sicuro di essere su macOS/Linux?");

    // Costruisci il percorso ~/local-data/reth.db
    let mut path = PathBuf::from(home);
    path.push(".local");
    path.push("state");
    path.push("reth");

    // Crea la cartella se non esiste
    std::fs::create_dir_all(&path).unwrap(); // TODO: rimuovere unwrap

    // Aggiungi il nome del file
    path.push("reth.db");

    // Apri o crea il DB
    let conn = Connection::open(path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS account (
            address TEXT PRIMARY KEY
        )",
        [],
    )?;

    // Crea la tabella se manca
    conn.execute(
        "CREATE TABLE IF NOT EXISTS reth_values (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            balance_reth REAL NOT NULL,
            reth_converted REAL NOT NULL,
            balance_eth REAL NOT NULL,
            total_eth_balance REAL NOT NULL,
            FOREIGN KEY(address) REFERENCES accounts(address)
        )",
        [],
    )?;

    Ok(conn)
}

/// Parses a string slice into an Ethereum `Address`.
///
/// # Parameters
/// - `x`: A string slice representing the Ethereum address.
///
/// # Returns
/// A `Result` containing the parsed `Address` or an error.
fn get_address_str(x: &str) -> Result<Address> {
    return Ok(x.parse()?);
}

/// Parses a `String` into an Ethereum `Address`.
///
/// # Parameters
/// - `x`: A `String` representing the Ethereum address.
///
/// # Returns
/// A `Result` containing the parsed `Address` or an error.
fn get_address(x: String) -> Result<Address> {
    return get_address_str(x.as_str());
}

/// Commands supported by the CLI tool.
#[derive(Subcommand, Clone, Debug, PartialEq, Eq)]
enum Command {
    /// Adds an Ethereum address to watch.
    AddWatchAddress {
        /// The Ethereum address to add.
        #[arg(short, long)]
        address: String,
    },

    /// Updates the stored staking rewards data.
    Update,

    /// Lists the tracked addresses and their staking reward history.
    List,

    Popolate {
        /// The Ethereum address to add.
        #[arg(short, long)]
        address: String,
        /// start
        start_block_id: u128, // TODO: bigger number
        /// end
        end_block_id: u128,
    },
}

/// Main CLI configuration.
#[derive(Parser, Debug)]
#[command(
    name = "reth-tracker",
    author = "Luca Sforza <lucasforza1234@icloud.com>",
    version,
    about = "
reth-tracker allows you to monitor the staking rewards of an Ethereum address
using Rocket Pool ETH.

It provides the ability to track the conversion rate of rETH to ETH directly
from the protocol. This value is not influenced by the market price of rETH,
but accurately reflects the Ether accrued through staking.

The tool is designed to help users keep a historical record of their staking
rewards over time and calculate their returns.",
    long_about = None
)]
struct Args {
    /// The command to execute.
    #[command(subcommand)]
    command: Command,

    /// RPC endpoint used to interact with the Ethereum network.
    #[arg(
        short,
        long,
        default_value_t = String::from("https://eth.llamarpc.com")
    )]
    rpc_address: String,

    /// Address of the rETH contract.
    #[
        arg(
            short,
            long,
            default_value_t = String::from("0xae78736Cd615f374D3085123A210448E74Fc6393")
        )
    ]
    address_reth: String,
}

/// Retrieves staking and balance values for a given Ethereum address.
///
/// # Parameters
/// - `provider`: A reference to the Ethereum provider.
/// - `address`: The Ethereum address to query.
/// - `address_reth`: The rETH contract address.
///
/// # Returns
/// A `Result` containing a tuple with:
/// - rETH balance (f64),
/// - rETH converted to ETH (f64),
/// - ETH balance of the address (f64),
/// - total ETH balance including converted rETH (f64).
async fn get_values<F, N>(
    provider: &F,
    address: Address,
    address_reth: Address,
) -> Result<(f64, f64, f64, f64)>
where
    F: Provider<N>,
    N: Network,
{
    let address_eth_balance = provider.get_balance(address).await?;

    let reth = RocketTokenRETH::new(address_reth, provider);

    let decimals = reth.decimals().call().await?;

    let balance_reth = reth.balanceOf(address).call().await?;

    let balance_eth = reth.getEthValue(balance_reth).call().await?;

    let total_eth_balance = balance_eth + address_eth_balance;

    let balance_reth = balance_reth.to_string().parse::<f64>()? / 10f64.powi(decimals as i32);
    let balance_eth = balance_eth.to_string().parse::<f64>()? / 1e18;
    let total_eth_balance = total_eth_balance.to_string().parse::<f64>()? / 1e18;
    let address_eth_balance = address_eth_balance.to_string().parse::<f64>()? / 1e18;

    return Ok((
        balance_reth,
        balance_eth,
        address_eth_balance,
        total_eth_balance,
    ));
}

/// Retrieves staking and balance values for a given Ethereum address at a specified block.
///
/// # Parameters
/// - `provider`: A reference to the Ethereum provider.
/// - `address`: The Ethereum address to query.
/// - `address_reth`: The rETH contract address.
/// - `block_numer`: the block number
///
/// # Returns
/// A `Result` containing a tuple with:
/// - rETH balance (f64),
/// - rETH converted to ETH (f64),
/// - ETH balance of the address (f64),
/// - total ETH balance including converted rETH (f64).
async fn get_values_at_block<F, N>(
    provider: &F,
    address: Address,
    address_reth: Address,
    block_number: u64,
) -> Result<(f64, f64, f64, f64)>
where
    F: Provider<N>,
    N: Network,
{
    let block_id = BlockId::from(block_number);
    // ETH normale
    let eth_balance = provider.get_balance(address).block_id(block_id).await?;

    let reth = RocketTokenRETH::new(address_reth, provider);

    let decimals = reth.decimals().block(block_id).call().await?;

    let balance_reth = reth.balanceOf(address).block(block_id).call().await?;

    let balance_eth = reth
        .getEthValue(balance_reth)
        .block(block_id)
        .call()
        .await?;

    let total_eth = eth_balance + balance_eth;

    // converti da U256 / Wei a f64
    let balance_reth_f = balance_reth.to_string().parse::<f64>()? / 10f64.powi(decimals as i32);
    let eth_balance_f = eth_balance.to_string().parse::<f64>()? / 1e18;
    let balance_eth_f = balance_eth.to_string().parse::<f64>()? / 1e18;
    let total_eth_f = total_eth.to_string().parse::<f64>()? / 1e18;

    Ok((balance_reth_f, balance_eth_f, eth_balance_f, total_eth_f))
}

/// Inserts staking reward data into the database.
///
/// # Parameters
/// - `conn`: Reference to the SQLite database connection.
/// - `address`: Ethereum address as a string slice.
/// - `balance_reth`: The rETH balance.
/// - `balance_eth`: The rETH converted to ETH.
/// - `address_eth_balance`: The ETH balance of the address.
/// - `total_eth_balance`: The total ETH balance including converted rETH.
///
/// # Returns
/// A `Result` indicating success or failure.
fn insert_into_database(
    conn: &Connection,
    address: &str,
    balance_reth: f64,
    balance_eth: f64,
    address_eth_balance: f64,
    total_eth_balance: f64,
) -> Result<()> {
    conn.execute(
        "INSERT INTO reth_values (
            address,
            timestamp,
            balance_reth,
            reth_converted,
            balance_eth,
            total_eth_balance
        ) VALUES (?, strftime('%s','now'), ?, ?, ?, ?)",
        (
            address,
            balance_reth,
            balance_eth,
            address_eth_balance,
            total_eth_balance,
        ),
    )?;

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    // Indirizzo del contratto già deployato

    let args = Args::parse();

    let rpc_url = Url::from_str(args.rpc_address.as_str())?;

    let address_reth = get_address_str(args.address_reth.as_str())?;

    let provider = ProviderBuilder::new().connect_http(rpc_url);

    match args.command {
        Command::AddWatchAddress { address } => {
            let conn = get_db()?;
            conn.execute(
                "INSERT OR IGNORE INTO account (address) values (?)",
                [address],
            )?;
        }
        Command::Update => {
            let conn = get_db()?;

            let mut stmt = conn.prepare("SELECT address FROM account")?;
            let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;

            for row in rows {
                let addr_str = row?;
                let addr = get_address_str(&addr_str)?;

                let (balance_reth, balance_eth, address_eth_balance, total_eth_balance) =
                    get_values(&provider, addr, address_reth).await?;
                println!("----------------------------------");
                println!("    Address: {}", addr_str);
                println!("    rETH: {}", balance_reth);
                println!("    rETH -> ETH: {}", balance_eth);
                println!("    ETH locked in address: {}", address_eth_balance);
                println!("    Total ETH: {}", total_eth_balance);
                insert_into_database(
                    &conn,
                    addr_str.as_str(),
                    balance_reth,
                    balance_eth,
                    address_eth_balance,
                    total_eth_balance,
                )?;
            }
        }
        Command::List => {
            let conn = get_db()?;

            let mut stmt = conn.prepare("SELECT address FROM account")?;
            let addresses = stmt.query_map([], |row| row.get::<_, String>(0))?;

            for addr_str in addresses {
                let addr_str = addr_str?;
                println!("==============================");
                println!("Address: {}", addr_str);

                let mut hist = conn.prepare(
                    "SELECT timestamp, balance_reth, reth_converted, balance_eth, total_eth_balance
                    FROM reth_values
                    WHERE address = ?
                    ORDER BY timestamp ASC",
                )?;

                let entries = hist.query_map([addr_str.as_str()], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, f64>(1)?,
                        row.get::<_, f64>(2)?,
                        row.get::<_, f64>(3)?,
                        row.get::<_, f64>(4)?,
                    ))
                })?;

                for e in entries {
                    let (ts, breth, rconv, beth, total) = e?;
                    let datetime = DateTime::<Utc>::from_timestamp(ts, 0).unwrap(); /*DateTime::<Utc>::from_utc(
                                                                                        NaiveDateTime::from_timestamp_opt(ts, 0).unwrap(),
                                                                                        Utc,
                                                                                    );*/
                    println!("  Timestamp: {} ()", datetime);
                    println!("    rETH: {}", breth);
                    println!("    rETH → ETH: {}", rconv);
                    println!("    ETH locked: {}", beth);
                    println!("    Total ETH: {}", total);
                    println!();
                }
            }
        }
        Command::Popolate {
            address,
            start_block_id,
            end_block_id,
        } => {
            use futures::{stream::FuturesUnordered, StreamExt};
            use indicatif::ProgressBar;

            if end_block_id < start_block_id {
                eprintln!("[ERROR] end-block-id can not be less tha start-block-id");
                exit(1);
            }
            const BLOCK_IN_ONE_DAY: u128 = 7200;
            let mut block = start_block_id;
            let bar = ProgressBar::new(
                ((end_block_id - start_block_id) / BLOCK_IN_ONE_DAY)
                    .try_into()
                    .expect("Too many blocks, report this error in https://github.com/LucaSforza/reth-tracker"),
            );
            let mut tasks = FuturesUnordered::new();
            while block <= end_block_id {
                tasks.push(get_values_at_block(
                    &provider,
                    get_address_str(address.as_str())?,
                    address_reth,
                    block as u64, // TODO: please change
                ));
                block += BLOCK_IN_ONE_DAY;
            }
            let conn = get_db()?;
            while let Some(res) = tasks.next().await {
                match res {
                    Ok((balance_reth, balance_eth, address_eth_balance, total_eth_balance)) => {
                        insert_into_database(
                            &conn,
                            &address,
                            balance_reth,
                            balance_eth,
                            address_eth_balance,
                            total_eth_balance,
                        )?;
                    }
                    Err(e) => eprintln!("[WARNING] Error at block {}: {:?}", block, e),
                }
                bar.inc(1);
            }
            bar.finish();
        }
    }

    Ok(())
}
