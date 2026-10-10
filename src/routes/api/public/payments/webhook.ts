import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { isGrantAll } from "@/lib/entitlement";
import { OPERATOR_PACKAGE_SLUGS } from "@/lib/operator-slugs";

let cached: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!cached) {
    cached = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return cached;
}

function licenceKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const raw = Array.from(bytes, (b) => b.toString(36).toUpperCase().padStart(2, "0")).join("");
  return `APEX-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}`;
}

/**
 * Grant the purchased product. Standing grants (the full-stack bundle and
 * Tremor Full) are recorded as a single licence and expanded when licences are
 * read, so products released later are covered by the same purchase.
 */
async function grantLicences(userId: string, slug: string, orderRef: string, expiresAt: string | null = null) {
  const db = admin() as any;
  let slugs = [slug];

  if (isGrantAll(slug)) {
    const { data } = await db.from("products").select("slug").eq("status", "live");
    const rows = (data ?? []) as Array<{ slug: string }>;
    slugs = Array.from(new Set([slug, ...rows.map((r) => r.slug).filter((product) => !OPERATOR_PACKAGE_SLUGS.includes(product))]));
  }

  for (const productSlug of slugs) {
    const { data: existing } = await db
      .from("licences")
      .select("id, source")
      .eq("user_id", userId)
      .eq("product_slug", productSlug)
      .limit(1);
    if (existing && existing.length) {
      if (existing[0].source === "trial" || existing[0].source === "stripe") {
        const { error } = await db.from("licences").update({ source: "stripe", status: "active", expires_at: expiresAt, order_ref: orderRef }).eq("id", existing[0].id);
        if (error) throw error;
      }
      continue;
    }

    await db.from("licences").insert({
      user_id: userId,
      product_slug: productSlug,
      licence_key: licenceKey(),
      status: "active",
      source: "stripe",
      order_ref: orderRef,
      expires_at: expiresAt,
    });
  }
}

/** Subscribers keep access 30 days past the paid period: a free month after
 * cancelling, and a 30-day cycle to fix a failed card before paid tools lock. */
const GRACE_MS = 30 * 24 * 60 * 60 * 1000;

async function syncSubscription(sub: any) {
  const userId = sub?.metadata?.userId;
  const slug = sub?.metadata?.productSlug;
  if (!userId || !slug) {
    console.error("Subscription event without userId/productSlug metadata");
    return;
  }
  const item = sub.items?.data?.[0];
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  const base = periodEnd ? periodEnd * 1000 : Date.now();
  const expiresAt = new Date(base + GRACE_MS).toISOString();
  if (sub.status === "incomplete" || sub.status === "incomplete_expired") return;
  await grantLicences(userId, slug, sub.id, expiresAt);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  const fulfil = async (session: any) => {
    const userId = session?.metadata?.userId;
    const slug = session?.metadata?.productSlug;
    if (!userId || !slug) {
      console.error("Checkout completed without userId/productSlug metadata");
      return;
    }
    await grantLicences(userId, slug, session.id ?? "");
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Subscriptions are granted from their own events so expiry tracks renewals.
      if (session.mode !== "subscription" && session.payment_status !== "unpaid") await fulfil(session);
      break;
    }
    case "checkout.session.async_payment_succeeded":
      if (event.data.object.mode !== "subscription") await fulfil(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
    default:
      console.log("Unhandled payment event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payment webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
