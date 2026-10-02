import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { isGrantAll } from "@/lib/entitlement";

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
async function grantLicences(userId: string, slug: string, orderRef: string) {
  const db = admin() as any;
  let slugs = [slug];

  if (isGrantAll(slug)) {
    const { data } = await db.from("products").select("slug").eq("status", "live");
    const rows = (data ?? []) as Array<{ slug: string }>;
    slugs = Array.from(new Set([slug, ...rows.map((r) => r.slug)]));
  }

  for (const productSlug of slugs) {
    const { data: existing } = await db
      .from("licences")
      .select("id")
      .eq("user_id", userId)
      .eq("product_slug", productSlug)
      .limit(1);
    if (existing && existing.length) continue;

    await db.from("licences").insert({
      user_id: userId,
      product_slug: productSlug,
      licence_key: licenceKey(),
      status: "active",
      source: "stripe",
      order_ref: orderRef,
    });
  }
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
      if (session.payment_status !== "unpaid") await fulfil(session);
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await fulfil(event.data.object);
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
