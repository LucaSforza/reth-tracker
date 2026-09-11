export type EthereumAddress = `0x${string}`;

export type Locale = "en" | "it";

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

export interface TrackerState {
  watchedAddresses: EthereumAddress[];
  selectedAddress?: EthereumAddress;
  snapshots: ChainSnapshot[];
  rpcUrl: string;
  /** Optional so v1 exports remain readable. The repository always returns it. */
  preferences?: DashboardPreferences;
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
}

export interface EthereumReader {
  readSnapshot(address: EthereumAddress, rpcUrl: string): Promise<ChainSnapshot>;
}
