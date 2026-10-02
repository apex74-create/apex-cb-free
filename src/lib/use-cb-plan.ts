import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/cloud";
import { verifiedLicences } from "@/lib/device-licence.functions";
import { deviceProof } from "@/lib/device-key";
import { isGrantAll } from "@/lib/entitlement";
import { CHANNEL_PLANS } from "@/lib/channels";
import { SCAN_CEILING } from "@/lib/cb-scan";

/** Licence slugs that unlock the CB upgrades. Read server-side, never from storage. */
export const SCANNER_SLUGS = ["wideband-scanner", "crew"];
export const CREW_SLUGS = ["crew"];

export type CbPlan = {
  channelMax: number;
  scanTotal: number;
  scanner: boolean;
  crew: boolean;
  /** "limit" when this device is over the plan's device count. */
  device: "ok" | "limit" | "unverified";
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

  useEffect(() => {
    if (!session) {
      setPlan(FREE);
      return;
    }
    let live = true;
    void (async () => {
      const proof = await deviceProof(session.user.id);
      if (!proof) return live && setPlan(FREE);
      const { slugs, status } = await check({ data: proof });
      if (!live) return;
      const all = slugs.some(isGrantAll);
      const crew = all || slugs.some((s) => CREW_SLUGS.includes(s));
      const scanner = crew || slugs.some((s) => SCANNER_SLUGS.includes(s));
      setPlan({
        channelMax: crew ? CHANNEL_PLANS.commercial.channels : CHANNEL_PLANS.free.channels,
        scanTotal: scanner ? SCAN_CEILING : CHANNEL_PLANS.free.channels,
        scanner,
        crew,
        device: status,
      });
    })().catch(() => live && setPlan(FREE));
    return () => {
      live = false;
    };
  }, [session, check]);

  return plan;
}
