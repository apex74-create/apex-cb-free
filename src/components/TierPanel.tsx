import { Link } from "@tanstack/react-router";
import { TIERS, useTier } from "@/lib/saas";

/**
 * Entitlement deck — read only. The tier is owned by the backend
 * (`entitlements`, RLS protected) and is granted by trusted payment
 * processing; nothing here can change it from the client.
 */
export default function TierPanel() {
  const { tier } = useTier();

  return (
    <section className="mt-3 border-t border-border pt-2">
      <p className="text-[8px] uppercase tracking-widest text-muted-foreground">
        entitlement · current {tier}
      </p>
      <div className="mt-1 space-y-1">
        {TIERS.map((t) => {
          const active = t.tier === tier;
          return (
            <div
              key={t.tier}
              className={`w-full rounded-sm border p-1.5 text-left ${
                active ? "border-signal/70 bg-card/70" : "border-border/60 bg-card/40"
              }`}
            >
              <p className="flex justify-between text-[9px] uppercase tracking-widest">
                <span className={active ? "text-signal" : "text-foreground"}>{t.name}</span>
                <span className="text-muted-foreground">{t.price}</span>
              </p>
              <p className="text-[8px] leading-snug text-muted-foreground">{t.perks.join(" · ")}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[8px] uppercase tracking-widest text-muted-foreground">
        upgrades activate from checkout · server issued
      </p>

      <div className="mt-1 grid grid-cols-2 gap-1">
        <Link
          to="/tristar"
          className="rounded-sm border border-warn/60 py-1 text-center text-[8px] uppercase tracking-widest text-warn"
        >
          tristar
        </Link>
        <Link
          to="/radar"
          className="rounded-sm border border-scan/60 py-1 text-center text-[8px] uppercase tracking-widest text-scan"
        >
          radar
        </Link>
      </div>
    </section>
  );
}
