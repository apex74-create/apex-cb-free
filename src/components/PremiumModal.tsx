import { Link } from "@tanstack/react-router";
import type { SubscriptionTier } from "@/services/forecastApi";

// Mirrors docs/PRICING.md weather ladder. Every licence except Gorilla Grow carries
// the 90-day aggregate sensor study; Gorilla Grow is study-exempt.
const TIERS: { id: SubscriptionTier | "greenhouse"; label: string; price: string; perks: string[] }[] = [
  {
    id: "free",
    label: "Free Research Study",
    price: "$0",
    perks: ["basic daily view", "3/6/9-day ground checks", "90-day aggregate study"],
  },
  {
    id: "pro",
    label: "Weather Standard",
    price: "$9.99 once",
    perks: ["full Doppler", "almanac + lunar planting", "90-day study, then off the licence"],
  },
  {
    id: "greenhouse",
    label: "Greenhouse Edition",
    price: "$49.99 once",
    perks: ["Weather Standard", "80-ch CB on 6 handsets", "90-day study, then off the licence"],
  },
  {
    id: "enterprise",
    label: "Gorilla Grow Kit",
    price: "$199 once · $29.99/mo",
    perks: ["full CB + Shield dash + Doppler", "notes + snapshots", "no study participation"],
  },
];

type PremiumModalProps = {
  open: boolean;
  currentTier: SubscriptionTier;
  onClose: () => void;
};

export default function PremiumModal({ open, currentTier, onClose }: PremiumModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-background/75 p-2 sm:items-center sm:justify-center">
      <div className="w-full max-w-lg rounded-sm border border-signal/50 bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-signal">
            Forecast plans
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-border px-2 py-1 text-[8px] uppercase tracking-widest text-muted-foreground"
          >
            close
          </button>
        </div>
        <div className="space-y-2">
          {TIERS.map((tier) => {
            const active = tier.id === currentTier;
            return (
              <article
                key={tier.id}
                className={`rounded-sm border p-2 ${active ? "border-signal bg-card/70" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <h3
                    className={`text-[9px] font-bold uppercase tracking-widest ${active ? "text-signal" : "text-foreground"}`}
                  >
                    {tier.label}
                  </h3>
                  <span className="text-[8px] uppercase tracking-widest text-muted-foreground">
                    {tier.price}
                  </span>
                </div>
                <p className="mt-1 text-[8px] leading-relaxed text-muted-foreground">
                  {tier.perks.join(" · ")}
                </p>
              </article>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Link
            to="/auth"
            className="rounded-sm border border-signal/60 py-1.5 text-center text-[8px] font-bold uppercase tracking-widest text-signal"
          >
            manage billing
          </Link>
          <Link
            to="/feed"
            className="rounded-sm border border-scan/60 py-1.5 text-center text-[8px] font-bold uppercase tracking-widest text-scan"
          >
            community feed
          </Link>
        </div>
      </div>
    </div>
  );
}
