import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/cloud";
import { verifiedLicences } from "@/lib/device-licence.functions";
import { checkLicences, clearLicenceCache } from "@/lib/licence-check";
import { isGrantAll } from "@/lib/entitlement";
import { CHANNEL_PLANS } from "@/lib/channels";
import { SCAN_CEILING } from "@/lib/cb-scan";

/** Licence slugs that unlock the CB upgrades. Read server-side, never from storage. */
export const SCANNER_SLUGS = ["wideband-scanner", "crew"];
export const CREW_SLUGS = ["crew", "cb-crew", "cb-job-site", "cb-site-pro"];
export const SQUAD_SLUGS = ["cb-family-squad"];
export const PAIR_SLUGS = ["cb-keep-it-pair"];
export const WATCH_SLUGS = ["apex-signal-watch"];

export type CbPlan = {
  channelMax: number;
  scanTotal: number;
  scanner: boolean;
  crew: boolean;
  /** "limit" when this device is over the plan's device count. */
  device: "ok" | "limit" | "unverified";
  /** signed in but nothing paid came back — show why and offer a recheck */
  signedIn?: boolean;
  /** clear the shared cache and ask the server again */
  recheck?: () => void;
};

const FREE: CbPlan = {
  channelMax: CHANNEL_PLANS.free.channels,
  scanTotal: CHANNEL_PLANS.free.channels,
  scanner: false,
  crew: false,
  device: "unverified",
};

export function useCbPlan(): CbPlan {
  const { session } = useSession();
  const check = useServerFn(verifiedLicences);
  const [plan, setPlan] = useState<CbPlan>(FREE);
  const [nonce, setNonce] = useState(0);
  const recheck = () => {
    clearLicenceCache();
    setNonce((n) => n + 1);
  };

  useEffect(() => {
    if (!session) {
      setPlan(FREE);
      return;
    }
    let live = true;
    void (async () => {
      const { slugs, status } = await checkLicences(check, session.user.id);
      if (!live) return;
      const all = slugs.some(isGrantAll);
      const crew = all || slugs.some((s) => CREW_SLUGS.includes(s));
      const squad = crew || slugs.some((s) => SQUAD_SLUGS.includes(s));
      const pair = squad || slugs.some((s) => PAIR_SLUGS.includes(s));
      const scanner = squad || slugs.some((s) => SCANNER_SLUGS.includes(s));
      const watch = slugs.some((s) => WATCH_SLUGS.includes(s));
      setPlan({
        channelMax: crew ? CHANNEL_PLANS.commercial.channels : squad ? CHANNEL_PLANS.squad.channels : pair ? CHANNEL_PLANS.pair.channels : watch ? 40 : CHANNEL_PLANS.free.channels,
        scanTotal: crew ? SCAN_CEILING : squad ? CHANNEL_PLANS.squad.channels : pair ? CHANNEL_PLANS.pair.channels : watch ? 40 : CHANNEL_PLANS.free.channels,
        scanner,
        crew,
        device: status,
        signedIn: true,
      });
      // A transient miss (proof not ready, flaky hotspot) shouldn't pin a
      // licence holder to free 20 — ask once more shortly after.
      if (status !== "ok" && nonce === 0) setTimeout(() => live && recheck(), 8000);
    })().catch(() => live && setPlan(FREE));
    return () => {
      live = false;
    };
  }, [session, check, nonce]);

  return { ...plan, recheck };
}
