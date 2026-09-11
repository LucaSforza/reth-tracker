export type EthereumAddress = `0x${string}`;

export type Locale = "en" | "it";

export type StoragePersistenceState = "checking" | "granted" | "not-granted" | "unsupported" | "error";

export interface StoragePersistenceStatus {
  state: StoragePersistenceState;
  persisted: boolean;
}

export interface DashboardPreferences {
  locale: Locale;
  visibleSections: {
    overview: boolean;
    chart: boolean;
    history: boolean;
  };
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  locale: "en",
  visibleSections: { overview: true, chart: true, history: true },
};

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

export interface RethTransferRecord {
  id: string;
  trackedAddress: EthereumAddress;
  transactionHash: string;
  logIndex: string;
  transactionIndex: string;
  blockNumber: string;
  blockHash?: string;
  capturedAt: number;
  from: EthereumAddress;
  to: EthereumAddress;
  amountWei: string;
}

export interface ProtocolRateSample {
  blockNumber: string;
  blockHash?: string;
  capturedAt: number;
  rateWei: string;
}

export type HistoricalSyncStatus = "running" | "error" | "cancelled" | "complete";

export interface HistoricalSyncState {
  address: EthereumAddress;
  fromBlock: string;
  targetBlock: string;
  nextBlock: string;
  status: HistoricalSyncStatus;
  updatedAt: number;
  completedAt?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface HistoricalYieldPoint {
  address: EthereumAddress;
  blockNumber: string;
  capturedAt: number;
  balanceWei: string;
  rateWei: string;
  intervalYieldWei: string;
  cumulativeYieldWei: string;
}

export interface HistoricalYieldResult {
  address: EthereumAddress;
  firstIncomingBlock?: string;
  terminalBlock: string;
  terminalBalanceWei: string;
  cumulativeYieldWei: string;
  points: HistoricalYieldPoint[];
}

export interface TrackerState {
  watchedAddresses: EthereumAddress[];
  selectedAddress?: EthereumAddress;
  snapshots: ChainSnapshot[];
  rpcUrl: string;
  /** Optional so v1 exports remain readable. The repository always returns it. */
  preferences?: DashboardPreferences;
  historicalTransfers?: RethTransferRecord[];
  protocolRates?: ProtocolRateSample[];
  historicalSyncs?: HistoricalSyncState[];
}

export interface TrackerRepository {
  load(): Promise<TrackerState>;
  addAddress(address: EthereumAddress): Promise<TrackerState>;
  removeAddress(address: EthereumAddress): Promise<TrackerState>;
  saveSnapshot(snapshot: ChainSnapshot): Promise<TrackerState>;
  setRpcUrl(rpcUrl: string): Promise<TrackerState>;
  setPreferences(preferences: DashboardPreferences): Promise<TrackerState>;
  selectAddress(address?: EthereumAddress): Promise<TrackerState>;
  exportJson(): Promise<string>;
  importJson(json: string): Promise<TrackerState>;
  clear(): Promise<TrackerState>;
  saveHistoricalChunk(records: readonly RethTransferRecord[], sync: HistoricalSyncState, replaceRange?: { fromBlock: string; toBlock: string }): Promise<void>;
  saveProtocolRates(samples: readonly ProtocolRateSample[]): Promise<void>;
  getHistoricalTransfers(address: EthereumAddress): Promise<RethTransferRecord[]>;
  getProtocolRates(blockNumbers?: readonly string[]): Promise<ProtocolRateSample[]>;
  getHistoricalSync(address: EthereumAddress): Promise<HistoricalSyncState | undefined>;
  saveHistoricalSync(sync: HistoricalSyncState): Promise<void>;
}

export interface EthereumReader {
  readSnapshot(address: EthereumAddress, rpcUrl: string): Promise<ChainSnapshot>;
}
