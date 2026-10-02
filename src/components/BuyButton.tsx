import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { CatalogProduct } from "@/lib/catalog.functions";
import { PRICE_IDS } from "@/lib/catalog";
import { paymentsConfigured } from "@/lib/stripe";
import { useSession } from "@/lib/cloud";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";

/**
 * Checkout entry point. Opens the card form inline; a purchase writes the
 * licence server-side, so /account shows it the moment payment clears.
 */
export default function BuyButton({ product }: { product: CatalogProduct }) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);

  if (product.status !== "live" || product.price_usd === null) {
    return (
      <span className="rounded-sm border border-warn/50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-warn">
        In development
      </span>
    );
  }

  const priceId = PRICE_IDS[product.slug];

  if (!priceId || !paymentsConfigured()) {
    return (
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Card payment for this product is not switched on yet. Installs and downloads stay open
        in the meantime.
      </p>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/auth"
          className="rounded-sm border border-signal/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-signal hover:bg-signal/10"
        >
          Sign in to buy ${product.price_usd.toFixed(2)}
        </Link>
        <p className="w-full text-[10px] leading-relaxed text-muted-foreground">
          Your licence is tied to your account, so buying needs you signed in first.
        </p>
      </div>
    );
  }

  if (open) {
    return (
      <div className="w-full">
        <StripeEmbeddedCheckout
          priceId={priceId}
          productSlug={product.slug}
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
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm border border-signal/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-signal hover:bg-signal/10"
      >
        Buy ${product.price_usd.toFixed(2)}
      </button>
      <Link
        to="/account"
        className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-signal"
      >
        Already own it?
      </Link>
    </div>
  );
}
