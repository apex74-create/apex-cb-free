import type { ReactNode } from "react";
import { BridgeContext, useBridge, useBridgeState } from "./bridge-hooks";
import { useAdbBridge } from "./use-adb-bridge";

/**
 * One bridge link for the whole app. Every tool reads real device output
 * through this connection — nothing is generated locally.
 */
export function BridgeProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const bridge = useAdbBridge(enabled);
  return <BridgeContext.Provider value={bridge}>{children}</BridgeContext.Provider>;
}

export { useBridge, useBridgeState };
