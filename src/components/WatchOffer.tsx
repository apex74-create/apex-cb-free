import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/cloud";
import { listProducts } from "@/lib/catalog.functions";
import { verifiedLicences } from "@/lib/device-licence.functions";
import { checkLicences } from "@/lib/licence-check";
import { isGrantAll } from "@/lib/entitlement";
import { bundledSlugs } from "@/lib/entitlement";
import { startWatchTrial } from "@/lib/watch-trial.functions";
import BuyButton from "@/components/BuyButton";

export default function WatchOffer() {
  const { session } = useSession();
  const start = useServerFn(startWatchTrial);
  const check = useServerFn(verifiedLicences);
  const [access, setAccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const { data: products = [] } = useQuery({ queryKey: ["watch-offer-product"], queryFn: () => listProducts(), staleTime: 60_000 });
  const watch = products.find((product) => product.slug === "apex-signal-watch");

  useEffect(() => {
    if (!session) { setAccess(false); return; }
    let live = true;
    void (async () => {
      const result = await checkLicences(check, session.user.id);
      if (live) setAccess(result.status === "ok" && result.slugs.some(slug => slug === "apex-signal-watch" || isGrantAll(slug) || bundledSlugs(slug).includes("apex-signal-watch")));
    })().catch(() => { if (live) setAccess(false); });
    return () => { live = false; };
  }, [session, check]);

  async function activate() {
    setBusy(true); setNote("");
    try {
      const result = await start();
      if (result.state === "inactive") {
        setNote("This Watch licence is inactive. Contact support before buying again.");
      } else if (result.state === "trial" && result.expiresAt && Date.parse(result.expiresAt) <= Date.now()) {
        setNote("Your seven-day trial has ended. Buy the Watch to continue.");
      } else {
        setAccess(true);
        setNote(result.state === "trial" ? "Your Watch trial is active on this account." : "Your Watch licence is active.");
      }
    } catch { setNote("The trial could not start right now. Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="mt-6 space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      {access ? <Button asChild><Link to="/app">Open Signal Watch</Link></Button> : session ? <Button onClick={() => void activate()} disabled={busy}>{busy ? "Checking…" : "Start 7-day trial"}</Button> : <Button asChild><Link to="/auth" search={{ next: "/" }}>Sign in for 7-day trial</Link></Button>}
      {watch && <BuyButton product={watch} />}
    </div>
    {note && <p role="status" className="text-xs text-scan">{note}</p>}
  </div>;
}