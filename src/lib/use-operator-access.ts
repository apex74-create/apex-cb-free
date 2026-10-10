import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/cloud";
import { verifiedLicences } from "@/lib/device-licence.functions";
import { checkLicences } from "@/lib/licence-check";
import { OPERATOR_PACKAGE_SLUGS } from "@/lib/operator-slugs";

/**
 * Signal Network Operator package: the wrist signal-network console and the
 * operator kits. Holding any of these unlocks the bridge dot, bridge console
 * and operator tools inside every app. Read server-side, never from storage.
 */
export function useOperatorAccess(): boolean {
  const { session } = useSession();
  const check = useServerFn(verifiedLicences);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setOk(false);
      return;
    }
    let live = true;
    const job = (async () => {
      const { slugs, status } = await checkLicences(check, uid);
      return status === "ok" && slugs.some((s) => OPERATOR_PACKAGE_SLUGS.includes(s));
    })().catch(() => false);
    void job.then((v) => live && setOk(v));
    return () => {
      live = false;
    };
  }, [session, check]);

  return ok;
}
