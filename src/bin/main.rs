use std::str::FromStr;

use alloy::network::Network;
use alloy::providers::Provider;
use alloy::{primitives::Address, providers::ProviderBuilder, transports::http::reqwest::Url};
use anyhow::Result;
use chrono::{DateTime, NaiveDateTime, Utc};
use clap::{arg, command, Parser, Subcommand};
use ethers::types::Res;
use reth_lib::rocket_token_reth::RocketTokenRETH;

use rusqlite::Connection;
use std::env;
use std::path::PathBuf;

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

fn get_address_str(x: &str) -> Result<Address> {
    return Ok(x.parse()?);
}

fn get_address(x: String) -> Result<Address> {
    return get_address_str(x.as_str());
}

#[derive(Subcommand, Clone, Debug, PartialEq, Eq)]
enum Command {
    AddWatchAddress {
        #[arg(short, long)]
        address: String,
    },

    Update,

    List,
}

/// Main CLI configuration.
#[derive(Parser, Debug)]
#[command(
    name = "reth-watch",
    author = "Luca Sforza <lucasforza1234@icloud.com>",
    version,
    about = None,
    long_about = None
)]
struct Args {
    #[command(subcommand)]
    command: Command,

    /// RPC endpoint used to interact with the Ethereum network.
    #[arg(
        short,
        long,
        default_value_t = String::from("https://eth.llamarpc.com")
    )]
    rpc_address: String,

    // Address of the rETH contract
    #[
        arg(
            short,
            long,
            default_value_t = String::from("0xae78736Cd615f374D3085123A210448E74Fc6393")
        )
    ]
    address_reth: String,
}

// It returns the rETH amount, the rETH converted in ETH, ETH in the address, total amount of ETH
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
    }

    Ok(())
}
