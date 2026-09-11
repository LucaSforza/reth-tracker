export type EthereumAddress = `0x${string}`;

export interface ChainSnapshot {
  id: string;
  address: EthereumAddress;
  capturedAt: number;
  blockNumber: string;
  rethBalanceWei: string;
  ethValueWei: string;
  ethBalanceWei: string;
  rateWei: string;
  /** rETH uses 18 decimals on Ethereum mainnet. Kept optional for imports from v0.1. */
  rethDecimals?: number;
}

export interface RewardPoint extends ChainSnapshot {
  intervalRewardWei: string;
  cumulativeRewardWei: string;
}

export interface TrackerState {
  watchedAddresses: EthereumAddress[];
  selectedAddress?: EthereumAddress;
  snapshots: ChainSnapshot[];
  rpcUrl: string;
}

export interface TrackerRepository {
  load(): Promise<TrackerState>;
  addAddress(address: EthereumAddress): Promise<TrackerState>;
  removeAddress(address: EthereumAddress): Promise<TrackerState>;
  saveSnapshot(snapshot: ChainSnapshot): Promise<TrackerState>;
  setRpcUrl(rpcUrl: string): Promise<TrackerState>;
  selectAddress(address?: EthereumAddress): Promise<TrackerState>;
  exportJson(): Promise<string>;
  importJson(json: string): Promise<TrackerState>;
  clear(): Promise<TrackerState>;
}

export interface EthereumReader {
  readSnapshot(address: EthereumAddress, rpcUrl: string): Promise<ChainSnapshot>;
}
