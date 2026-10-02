/**
 * SaaS tier gate.
 *
 * FREE  — everything that runs on the watch itself: ADB bridge, Wi-Fi scan,
 *         cell geo, PCAPdroid control, biometrics, faces, shell dock.
 * PRO   — wardrive node relay, mesh threat feed, ledger sync, release watch.
 * ELITE — sovereign backend, tristar thought engine + VFS memory, full RF matrix.
 *
 * The tier is held locally and mirrored by the sovereign token; every gated
 * call goes through `callTier` so an unentitled feature fails closed instead
 * of half-rendering. No keys live in this file — the relays are public
 * endpoints and anything privileged goes out through a server function.
 */

import { useEffect, useState } from "react";

/**
 * OPERATOR is the owner build: everything elite carries plus the unlimited
 * forecast horizon and full back history. It is granted server-side to the
 * owner account only and is never sold, so it does not appear in TIERS.
 */
export type Tier = "free" | "pro" | "elite" | "operator";

export const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, elite: 2, operator: 3 };

export const TIERS: { tier: Tier; name: string; price: string; perks: string[] }[] = [
  {
    tier: "free",
    name: "Field",
    price: "$0",
    perks: ["ADB bridge", "Wi-Fi + cell scan", "PCAPdroid control", "Biometrics", "Apex face"],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$9/mo",
    perks: [
      "Wardrive relay",
      "Threat feed",
      "token ledger sync",
      "Release watch",
      "Cloud session export",
    ],
  },
  {
    tier: "elite",
    name: "Elite",
    price: "$29/mo",
    perks: [
      "Sovereign backend",
      "TriStar thought engine",
      "VFS memory",
      "Full RF matrix",
      "Priority mesh routing",
    ],
  },
];

export const WARDRIVE_RELAY = "http://34.74.51.230:8369";
export const SOVEREIGN_BACKEND = "http://34.74.51.230:8370";

export const GH_RELEASES: Record<string, string> = {
  pcapdroid: "https://api.github.com/repos/emanuele-f/PCAPdroid/releases/latest",
  usbwifimonitor: "https://api.github.com/repos/emanuele-f/UsbWifiMonitorApi/releases/latest",
  termux: "https://api.github.com/repos/termux/termux-app/releases/latest",
  meshtastic: "https://api.github.com/repos/meshtastic/firmware/releases/latest",
};

/**
 * The entitlement is server-owned. It lives in the RLS-protected `entitlements`
 * table and is only ever written by the sign-up trigger / trusted payment
 * processing. Nothing here persists a tier locally, so editing browser storage
 * cannot unlock a paid feature: a signed-out visitor is always `free`.
 */
let cachedTier: Tier = "free";

function coerce(v: unknown): Tier {
  return v === "pro" || v === "elite" || v === "operator" ? v : "free";
}

/** Last known server tier. Read-only mirror, never authoritative on its own. */
export function getTier(): Tier {
  return cachedTier;
}

/** Ask the backend what this account is entitled to. Signed out ⇒ free. */
export async function loadTier(): Promise<Tier> {
  if (typeof window === "undefined") return "free";
  try {
    const { fetchCloudTier } = await import("@/lib/cloud");
    cachedTier = coerce(await fetchCloudTier());
  } catch {
    cachedTier = "free";
  }
  window.dispatchEvent(new CustomEvent("apexTierChange", { detail: cachedTier }));
  return cachedTier;
}

export const allows = (tier: Tier, needed: Tier) => TIER_RANK[tier] >= TIER_RANK[needed];

export function useTier(): { tier: Tier; allows: (needed: Tier) => boolean } {
  const [tier, set] = useState<Tier>("free");
  useEffect(() => {
    let live = true;
    void loadTier().then((t) => {
      if (live) set(t);
    });
    const on = () => set(getTier());
    window.addEventListener("apexTierChange", on);
    // The session can hydrate after the first check (installed app, slow
    // phones). Re-ask the server whenever sign-in state changes so an
    // entitled account is never stuck on the free horizon.
    let unsub: (() => void) | undefined;
    void import("@/integrations/supabase/client").then(({ supabase }) => {
      if (!live) return;
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
          void loadTier().then((t) => live && set(t));
        }
      });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => {
      live = false;
      unsub?.();
      window.removeEventListener("apexTierChange", on);
    };
  }, []);
  return { tier, allows: (needed: Tier) => allows(tier, needed) };
}

export class TierLocked extends Error {
  constructor(public needed: Tier) {
    super(`requires ${needed}`);
    this.name = "TierLocked";
  }
}

/**
 * Fails closed unless the *server* says this account is entitled. The tier is
 * re-fetched on every gated call, so no client-side value can unlock a feature.
 */
export async function callTier<T>(needed: Tier, fn: () => Promise<T>): Promise<T> {
  if (needed !== "free") {
    const tier = await loadTier();
    if (!allows(tier, needed)) throw new TierLocked(needed);
  }
  return fn();
}

export type ReleaseInfo = { tool: string; tag: string; published: string; url: string };

/** PRO: watch upstream releases for the tools the watch drives. */
export async function fetchRelease(tool: string): Promise<ReleaseInfo> {
  return callTier("pro", async () => {
    const url = GH_RELEASES[tool];
    if (!url) throw new Error(`unknown tool ${tool}`);
    const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw new Error(`github ${r.status}`);
    const d = (await r.json()) as Record<string, string>;
    return {
      tool,
      tag: d["tag_name"] ?? "?",
      published: d["published_at"] ?? "",
      url: d["html_url"] ?? "",
    };
  });
}
