import { createServerFn } from "@tanstack/react-start";
import { PRICE_IDS } from "@/lib/catalog";
import { SUBSCRIPTIONS, PERPETUAL, ENTERPRISE, DATA_PRODUCTS } from "@/lib/pricing";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

/** Server-side price → licence binding. The client never picks the slug. */
function allowedSlugsFor(priceId: string): Set<string> {
  const out = new Set<string>();
  for (const [slug, pid] of Object.entries(PRICE_IDS)) if (pid === priceId) out.add(slug);
  for (const t of [...SUBSCRIPTIONS, ...PERPETUAL, ...ENTERPRISE, ...DATA_PRODUCTS]) {
    if (t.priceId === priceId) out.add(t.licenceSlug);
  }
  return out;
}

type CheckoutSessionResult = { clientSecret: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length && found.data[0]) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      if (options.userId && customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      priceId: string;
      productSlug: string;
      customerEmail?: string;
      userId?: string;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
      if (!/^[a-zA-Z0-9-]+$/.test(data.productSlug)) throw new Error("Invalid product");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      // The buyer is always the signed-in caller, never a client-supplied id.
      const userId = context.userId;
      const email = (context.claims as { email?: string }).email;
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      const stripePrice = prices.data[0];
      if (!stripePrice) throw new Error("Price not found");

      const customerId = await resolveOrCreateCustomer(stripe, {
        ...(email ? { email } : {}),
        userId,
      });

      const productId =
        typeof stripePrice.product === "string"
          ? stripePrice.product
          : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);

      // The licence slug must come from the price's own product, not the client.
      if (!allowedSlugsFor(data.priceId).has(data.productSlug)) {
        throw new Error("Price does not match product");
      }
      const boundSlug = data.productSlug;

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        ...(customerId && { customer: customerId }),
        payment_intent_data: { description: product.name },
        managed_payments: { enabled: true },
        metadata: {
          productSlug: boundSlug,
          priceLookupKey: data.priceId,
          managed_payments: "true",
          userId,
        },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
