/** Errors exposed by the browser data layer.
 *
 * Keeping a small, stable error vocabulary lets the UI give useful advice
 * without having to know about IndexedDB, viem, or a particular RPC provider.
 */
export type TrackerErrorCode =
  | "invalid-address"
  | "invalid-rpc-url"
  | "rpc"
  | "offline"
  | "contract"
  | "storage"
  | "invalid-data";

export class TrackerError extends Error {
  readonly code: TrackerErrorCode;
  readonly cause?: unknown;

  constructor(code: TrackerErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "TrackerError";
    this.code = code;
    this.cause = cause;
  }
}

export function isTrackerError(error: unknown): error is TrackerError {
  return error instanceof TrackerError;
}
