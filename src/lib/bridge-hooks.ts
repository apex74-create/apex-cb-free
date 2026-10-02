import { createContext, useContext } from "react";
import type { useAdbBridge } from "./use-adb-bridge";

export type BridgeApi = ReturnType<typeof useAdbBridge>;

export const BridgeContext = createContext<BridgeApi | null>(null);

export function useBridge(): BridgeApi {
  const ctx = useContext(BridgeContext);
  if (!ctx) throw new Error("useBridge must be used inside <BridgeProvider>");
  return ctx;
}

export function useBridgeState(): BridgeApi["state"] {
  return useContext(BridgeContext)?.state ?? "idle";
}
