import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import type { EthereumAddress, ProtocolRateSample, RethTransferRecord } from "../domain/types";
import { TrackerError } from "./errors";
import { RETH_ABI, RETH_MAINNET_ADDRESS } from "./ethereum";
import { normalizeAddress, validateRpcUrl, weiString } from "./validation";

export const RETH_TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

export interface HistoricalChainReader {
  getHeadBlock(rpcUrl: string): Promise<string>;
  findContractStartBlock(rpcUrl: string): Promise<string>;
  readTransferChunk(address: EthereumAddress, rpcUrl: string, fromBlock: string, toBlock: string): Promise<RethTransferRecord[]>;
  readProtocolRate(rpcUrl: string, blockNumber: string): Promise<ProtocolRateSample>;
}

function createHistoryClient(rpcUrl: string) {
  return createPublicClient({ chain: mainnet, transport: http(validateRpcUrl(rpcUrl)) });
}

export type HistoricalEthereumClient = ReturnType<typeof createHistoryClient>;
export type HistoricalEthereumClientFactory = (rpcUrl: string) => HistoricalEthereumClient;

function historyError(error: unknown): TrackerError {
  if (error instanceof TrackerError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("missing trie") || lower.includes("pruned") || lower.includes("historical state") || lower.includes("archive")) {
    return new TrackerError("archive-rpc", "This endpoint does not expose the historical state required for rETH yield. Choose an archive RPC endpoint and retry; saved progress was kept.", error);
  }
  if (lower.includes("429") || lower.includes("too many") || lower.includes("limit exceeded") || lower.includes("rate limit")) {
    return new TrackerError("rate-limited", "The RPC endpoint limited the historical request. Retry later or choose another endpoint; saved progress was kept.", error);
  }
  return new TrackerError("sync", "Historical blockchain data could not be read. Saved progress was kept.", error);
}

async function assertMainnet(rpc: HistoricalEthereumClient) {
  if (await rpc.getChainId() !== 1) throw new TrackerError("wrong-network", "The RPC endpoint must connect to Ethereum mainnet.");
}

export class ViemHistoricalChainReader implements HistoricalChainReader {
  constructor(private readonly clientFactory: HistoricalEthereumClientFactory = createHistoryClient) {}

  async getHeadBlock(rpcUrl: string): Promise<string> {
    try { const rpc = this.clientFactory(validateRpcUrl(rpcUrl)); await assertMainnet(rpc); return (await rpc.getBlockNumber()).toString(); } catch (error) { throw historyError(error); }
  }

  async findContractStartBlock(rpcUrl: string): Promise<string> {
    try {
      const rpc = this.clientFactory(validateRpcUrl(rpcUrl));
      await assertMainnet(rpc);
      let low = 0n;
      let high = await rpc.getBlockNumber();
      const latestCode = await rpc.getBytecode({ address: RETH_MAINNET_ADDRESS, blockNumber: high });
      if (!latestCode || latestCode === "0x") throw new TrackerError("contract", "The canonical rETH contract is not available on this endpoint.");
      while (low < high) {
        const middle = (low + high) / 2n;
        const code = await rpc.getBytecode({ address: RETH_MAINNET_ADDRESS, blockNumber: middle });
        if (code && code !== "0x") high = middle;
        else low = middle + 1n;
      }
      return low.toString();
    } catch (error) { throw historyError(error); }
  }

  async readTransferChunk(address: EthereumAddress, rpcUrl: string, fromBlock: string, toBlock: string): Promise<RethTransferRecord[]> {
    const account = normalizeAddress(address);
    try {
      const rpc = this.clientFactory(validateRpcUrl(rpcUrl));
      await assertMainnet(rpc);
      const range = { address: RETH_MAINNET_ADDRESS, event: RETH_TRANSFER_EVENT, fromBlock: BigInt(fromBlock), toBlock: BigInt(toBlock), strict: true } as const;
      const [incoming, outgoing] = await Promise.all([
        rpc.getLogs({ ...range, args: { to: account } }),
        rpc.getLogs({ ...range, args: { from: account } }),
      ]);
      const unique = new Map<string, (typeof incoming)[number]>();
      for (const log of [...incoming, ...outgoing]) {
        if (log.blockNumber === null || log.logIndex === null || log.transactionIndex === null || !log.transactionHash) continue;
        const key = `${log.transactionHash}:${log.logIndex}`;
        const existing = unique.get(key);
        if (existing) {
          const left = existing.args as { from?: string; to?: string; value?: bigint };
          const right = log.args as { from?: string; to?: string; value?: bigint };
          if (existing.blockNumber !== log.blockNumber || left.from !== right.from || left.to !== right.to || left.value !== right.value) {
            throw new TrackerError("sync", `The RPC returned conflicting data for transfer ${key}.`);
          }
        } else unique.set(key, log);
      }
      const blockNumbers = [...new Set([...unique.values()].map((log) => log.blockNumber!.toString()))];
      const timestamps = new Map<string, { timestamp: number; hash?: string }>();
      await Promise.all(blockNumbers.map(async (number) => {
        const block = await rpc.getBlock({ blockNumber: BigInt(number) });
        timestamps.set(number, { timestamp: Number(block.timestamp) * 1000, ...(block.hash ? { hash: block.hash } : {}) });
      }));
      return [...unique.values()].map((log) => {
        const args = log.args as { from: EthereumAddress; to: EthereumAddress; value: bigint };
        const blockNumber = log.blockNumber!.toString();
        const metadata = timestamps.get(blockNumber)!;
        return {
          id: `${log.transactionHash}:${log.logIndex}`,
          trackedAddress: account,
          transactionHash: log.transactionHash!,
          transactionIndex: String(log.transactionIndex),
          logIndex: String(log.logIndex),
          blockNumber,
          capturedAt: metadata.timestamp,
          from: normalizeAddress(args.from),
          to: normalizeAddress(args.to),
          amountWei: weiString(BigInt(args.value)),
          ...(metadata.hash ? { blockHash: metadata.hash } : {}),
        };
      }).sort((a, b) => {
        for (const field of ["blockNumber", "transactionIndex", "logIndex"] as const) {
          const left = BigInt(a[field]); const right = BigInt(b[field]);
          if (left !== right) return left < right ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      });
    } catch (error) { throw historyError(error); }
  }

  async readProtocolRate(rpcUrl: string, blockNumber: string): Promise<ProtocolRateSample> {
    try {
      const rpc = this.clientFactory(validateRpcUrl(rpcUrl));
      await assertMainnet(rpc);
      const number = BigInt(blockNumber);
      const [rate, block] = await Promise.all([
        rpc.readContract({ address: RETH_MAINNET_ADDRESS, abi: RETH_ABI, functionName: "getExchangeRate", blockNumber: number }),
        rpc.getBlock({ blockNumber: number }),
      ]);
      return { blockNumber, capturedAt: Number(block.timestamp) * 1000, rateWei: weiString(BigInt(rate)), ...(block.hash ? { blockHash: block.hash } : {}) };
    } catch (error) { throw historyError(error); }
  }
}
