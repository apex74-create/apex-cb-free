import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/cloud";
import { verifiedLicences } from "@/lib/device-licence.functions";
import { checkLicences } from "@/lib/licence-check";

/**
 * Licence slugs this signed-in device holds, verified on the server.
 * `null` while checking; empty array for visitors without a licence.
 */
export function useOwnedSlugs(): string[] | null {
  const { session, loading } = useSession();
  const check = useServerFn(verifiedLicences);
  const [slugs, setSlugs] = useState<string[] | null>(null);
  useEffect(() => {
    if (loading) return;
    const uid = session?.user.id;
    if (!uid) { setSlugs([]); return; }
    let live = true;
    void (async () => {
      const r = await checkLicences(check, uid);
      return r.status === "ok" ? r.slugs : [];
    })().catch(() => []).then((s) => { if (live) setSlugs(s ?? []); });
    return () => { live = false; };
  }, [session, loading, check]);
  return slugs;
}

const PASS_KEY = "apex.preview.pass.v1";
const DAY = 24 * 60 * 60 * 1000;

/** One 24-hour preview pass per browser. Returns whether the pass is still usable. */
export function previewPassOpen(): boolean {
  try {
    const t = Number(localStorage.getItem(PASS_KEY) ?? 0);
    return !t || Date.now() - t < DAY;
  } catch { return true; }
}
export function startPreviewPass() {
  try { if (!localStorage.getItem(PASS_KEY)) localStorage.setItem(PASS_KEY, String(Date.now())); } catch { /* storage unavailable */ }
}
