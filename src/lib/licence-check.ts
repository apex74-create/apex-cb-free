import { deviceProof } from "@/lib/device-key";

/**
 * One shared licence check for every hook on the page.
 *
 * - Concurrent callers (top bar, CB plan, Shield, landing) share one server
 *   round-trip instead of each signing and posting their own proof.
 * - Offline grace: the last server-verified result for this account is kept so
 *   an owned app keeps working when the towers or the hotspot have no internet.
 *   It is only used when the server cannot be reached at all — a "limit" or
 *   "unverified" answer from the server is never overridden — and it expires
 *   after OFFLINE_GRACE_MS, so it can't stand in for a lapsed licence for long.
 */
export type LicenceResult = {
  slugs: string[];
  status: "ok" | "limit" | "unverified";
  offline?: boolean;
};

type Check = (args: { data: NonNullable<Awaited<ReturnType<typeof deviceProof>>> }) => Promise<{
  slugs: string[];
  status: "ok" | "limit" | "unverified";
}>;

const OFFLINE_KEY = "apex.licence.offline.v1";
const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;
const SHARE_MS = 60_000;

let inflight: { uid: string; at: number; job: Promise<LicenceResult> } | null = null;

function readOffline(uid: string): LicenceResult | null {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { uid: string; at: number; slugs: string[] };
    if (v.uid !== uid || Date.now() - v.at > OFFLINE_GRACE_MS) return null;
    return { slugs: v.slugs, status: "ok", offline: true };
  } catch {
    return null;
  }
}

function writeOffline(uid: string, slugs: string[]) {
  try {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify({ uid, at: Date.now(), slugs }));
  } catch {
    /* storage unavailable */
  }
}

export function clearLicenceCache() {
  inflight = null;
}

export function checkLicences(check: Check, uid: string): Promise<LicenceResult> {
  if (inflight && inflight.uid === uid && Date.now() - inflight.at < SHARE_MS) return inflight.job;
  const job = (async (): Promise<LicenceResult> => {
    try {
      const proof = await deviceProof(uid);
      if (!proof) return readOffline(uid) ?? { slugs: [], status: "unverified" };
      const r = await check({ data: proof });
      if (r.status === "ok") writeOffline(uid, r.slugs);
      return r;
    } catch {
      // Network or server unreachable: fall back to the last verified result.
      inflight = null;
      return readOffline(uid) ?? { slugs: [], status: "unverified" };
    }
  })();
  inflight = { uid, at: Date.now(), job };
  return job;
}
