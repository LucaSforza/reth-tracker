import {
  createPublicClient,
  http,
  isAddress,
} from "viem";
import { mainnet } from "viem/chains";
import type { ChainSnapshot, EthereumAddress, EthereumReader } from "../domain/types";
import { TrackerError } from "./errors";
import { normalizeAddress, validateRpcUrl, weiString } from "./validation";

export const RETH_MAINNET_ADDRESS = "0xae78736Cd615f374D3085123A210448E74Fc6393" as const;
export const DEFAULT_RPC_URL = "https://ethereum-rpc.publicnode.com";

export const RETH_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "getEthValue", stateMutability: "view", inputs: [{ name: "rethAmount", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getExchangeRate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

function createClient(rpcUrl: string) {
  return createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
}

export type EthereumClient = ReturnType<typeof createClient>;
export type EthereumClientFactory = (rpcUrl: string) => EthereumClient;

function classifyReadError(error: unknown): TrackerError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("offline") || lower.includes("timeout") || lower.includes("fetch")) {
  return new TrackerError("offline", "Unable to reach the RPC endpoint. Check your connection or choose another endpoint.", error);
  }
  if (lower.includes("revert") || lower.includes("contract") || lower.includes("execution")) {
    return new TrackerError("contract", "The rETH contract did not return a valid response.", error);
  }
  return new TrackerError("rpc", "The RPC endpoint rejected the request. Check the URL and provider availability.", error);
}

/** Read-only mainnet reader. It never requests a wallet or a signing capability. */
export class ViemEthereumReader implements EthereumReader {
  private readonly clientFactory: EthereumClientFactory;

  constructor(clientFactory: EthereumClientFactory = createClient) {
    this.clientFactory = clientFactory;
  }

  async readSnapshot(address: EthereumAddress, rpcUrl: string): Promise<ChainSnapshot> {
    const account = normalizeAddress(address);
    const endpoint = validateRpcUrl(rpcUrl);
    if (!isAddress(account, { strict: false })) {
      throw new TrackerError("invalid-address", "The Ethereum address is not valid.");
    }
    let client: EthereumClient;
    try {
      client = this.clientFactory(endpoint);
    } catch (error) {
      throw classifyReadError(error);
    }

    try {
      // Pin every read to the same block so a refresh cannot combine values
      // from two different protocol states.
      const blockNumber = await client.getBlockNumber();
      const rethBalance = await client.readContract({ address: RETH_MAINNET_ADDRESS, abi: RETH_ABI, functionName: "balanceOf", args: [account], blockNumber });
      const [ethBalance, ethValue, rate, decimals, block] = await Promise.all([
        client.getBalance({ address: account, blockNumber }),
        client.readContract({ address: RETH_MAINNET_ADDRESS, abi: RETH_ABI, functionName: "getEthValue", args: [rethBalance], blockNumber }),
        client.readContract({ address: RETH_MAINNET_ADDRESS, abi: RETH_ABI, functionName: "getExchangeRate", blockNumber }),
        client.readContract({ address: RETH_MAINNET_ADDRESS, abi: RETH_ABI, functionName: "decimals", blockNumber }),
        client.getBlock({ blockNumber }),
      ]);
      const capturedAt = Number(block.timestamp) * 1000;
      if (!Number.isSafeInteger(capturedAt) || capturedAt <= 0) {
        throw new TrackerError("rpc", "The RPC returned an invalid block timestamp.");
      }
      const normalizedBalance = BigInt(rethBalance);
      return {
        id: `${account}:${blockNumber.toString()}`,
        address: account,
        capturedAt,
        blockNumber: blockNumber.toString(),
        rethBalanceWei: weiString(normalizedBalance),
        ethValueWei: weiString(BigInt(ethValue)),
        ethBalanceWei: weiString(BigInt(ethBalance)),
        rateWei: weiString(BigInt(rate)),
        rethDecimals: Number(decimals),
      };
    } catch (error) {
      if (error instanceof TrackerError) throw error;
      throw classifyReadError(error);
    }
  }

  async readDecimals(rpcUrl: string): Promise<number> {
    const endpoint = validateRpcUrl(rpcUrl);
    try {
      const client = this.clientFactory(endpoint);
      const value = await client.readContract({ address: RETH_MAINNET_ADDRESS, abi: RETH_ABI, functionName: "decimals" });
      const decimals = Number(value);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new TrackerError("contract", "The rETH contract returned invalid decimals.");
      return decimals;
    } catch (error) {
      if (error instanceof TrackerError) throw error;
      throw classifyReadError(error);
    }
  }

}

export function createEthereumReader(clientFactory?: EthereumClientFactory): EthereumReader {
  return new ViemEthereumReader(clientFactory);
}
