// Community build: checkout and billing are not available.
// The full implementation lives in the private Apex estate.
import { createServerFn } from "@tanstack/react-start";

type StripeEnv = "test" | "live";
type CheckoutInput = {
  priceId: string;
  productSlug: string;
  customerEmail?: string;
  userId?: string;
  returnUrl: string;
  environment: StripeEnv;
};
type CheckoutResult = { clientSecret: string } | { error: string };
type PortalInput = { returnUrl: string; environment: StripeEnv };
type PortalResult = { url: string } | { error: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: CheckoutInput): CheckoutInput => data)
  .handler(async (): Promise<CheckoutResult> => ({
    error: "Checkout is unavailable in the community build.",
  }));

export const createPortalSession = createServerFn({ method: "POST" })
  .inputValidator((data: PortalInput): PortalInput => data)
  .handler(async (): Promise<PortalResult> => ({
    error: "Billing portal is unavailable in the community build.",
  }));
