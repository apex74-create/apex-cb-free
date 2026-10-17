import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { paymentsConfigured } from "@/lib/stripe";
import { useSession } from "@/lib/cloud";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";

/**
 * Checkout for a pricing tier rather than a catalogue row. The tier knows its
 * own price id and the licence slug it should grant, so plans that have no
 * catalogue entry (subscriptions, data products) can still be bought.
 */
export default function PlanBuyButton({
  priceId,
  productSlug,
  label,
  contactHref,
}: {
  priceId: string | null;
  productSlug: string;
  label: string;
  contactHref?: string;
}) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);

  if (!priceId) {
    return (
      <a
        href={contactHref ?? "mailto:sales@apexairsolutions.com"}
        className="inline-block rounded-sm border border-scan/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-scan hover:bg-scan/10"
      >
        Talk to us
      </a>
    );
  }

  if (!paymentsConfigured()) {
    return (
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Card payment is not switched on yet for this tier.
      </p>
    );
  }

  if (!session) {
    return (
      <Link
        to="/auth"
        className="inline-block rounded-sm border border-signal/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-signal hover:bg-signal/10"
      >
        Sign in to buy
      </Link>
    );
  }

  if (open) {
    return (
      <div className="w-full">
        <StripeEmbeddedCheckout
          priceId={priceId}
          productSlug={productSlug}
          {...(session.user.email ? { customerEmail: session.user.email } : {})}
          userId={session.user.id}
          returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-signal"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="rounded-sm border border-signal/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-signal hover:bg-signal/10"
    >
      {label}
    </button>
  );
}
