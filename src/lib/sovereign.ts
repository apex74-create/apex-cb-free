/**
 * Sovereign readiness: is the on-watch keypair present, the hash chain intact
 * and is there float to pay for a netchat message? Everything here is local —
 * no server, no custodian — so the badge is a real state, not a decoration.
 */

import { useEffect, useState } from "react";
import {
  balance,
  getKeys,
  loadChain,
  mint,
  verifyChain,
  walletAddress,
  type TokenEntry,
} from "@/lib/token";

export const MESSAGE_FEE = 1;

export type SovereignStatus = {
  /** Keys loaded, chain verified and enough token to send. */
  ready: boolean;
  loading: boolean;
  address: string | null;
  balance: number;
  chain: TokenEntry[];
  verified: boolean;
  badSeq?: number | undefined;
  error: string | null;
};

const IDLE: SovereignStatus = {
  ready: false,
  loading: true,
  address: null,
  balance: 0,
  chain: [],
  verified: false,
  error: null,
};

export async function readSovereign(): Promise<SovereignStatus> {
  try {
    const { pubHex } = await getKeys();
    const address = await walletAddress(pubHex);
    // First run on this watch: mint the sovereign bootstrap float so chat is
    // spendable immediately. Signed like every other entry.
    if (loadChain().length === 0) await mint(10);
    const chain = loadChain();
    const v = await verifyChain(chain);
    const bal = balance(chain);
    return {
      ready: v.ok && bal >= MESSAGE_FEE,
      loading: false,
      address,
      balance: bal,
      chain,
      verified: v.ok,
      badSeq: v.badSeq,
      error: null,
    };
  } catch (e) {
    return { ...IDLE, loading: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Live sovereign status, re-read on an interval so mints/spends show up. */
export function useSovereign(pollMs = 5000): SovereignStatus {
  const [status, setStatus] = useState<SovereignStatus>(IDLE);

  useEffect(() => {
    let alive = true;
    const tick = () => void readSovereign().then((s) => alive && setStatus(s));
    tick();
    const t = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pollMs]);

  return status;
}

/** Short human label for the badge line. */
export function sovereignLabel(s: SovereignStatus): string {
  if (s.loading) return "sovereign · keying";
  if (s.error) return "sovereign · fault";
  if (!s.verified) return `sovereign · chain break @${s.badSeq ?? "?"}`;
  if (s.balance < MESSAGE_FEE) return "sovereign · no float";
  return "sovereign chat ready";
}
