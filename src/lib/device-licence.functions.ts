import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Proof = z.object({
  pub: z.string().min(40).max(400),
  sigHash: z.string().min(20).max(100),
  ts: z.number(),
  sig: z.string().min(40).max(400),
});

const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Devices allowed per account: more for crew/grant-all plans. */
function deviceLimit(slugs: string[]) {
  if (slugs.some((s) => ["crew", "apex-full-stack", "apex-full-stack-monthly", "tremor-full", "operator-field"].includes(s))) return 5;
  return 2;
}

async function verify(userId: string, p: z.infer<typeof Proof>) {
  if (Math.abs(Date.now() - p.ts) > 120_000) return false;
  try {
    const key = await crypto.subtle.importKey("spki", unb64(p.pub), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      unb64(p.sig),
      new TextEncoder().encode(`${userId}|${p.ts}|${p.sigHash}`),
    );
  } catch {
    return false;
  }
}

/**
 * Paid licences, but only for a device that proves it holds its bound key.
 * Unknown devices are activated automatically while under the plan's limit;
 * beyond it they get nothing paid and `status: "limit"`.
 */
export const verifiedLicences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Proof.parse(d))
  .handler(async ({ data, context }) => {
    const empty = { slugs: [] as string[], status: "unverified" as "ok" | "limit" | "unverified" };
    if (!(await verify(context.userId, data))) return empty;
    const { data: held } = await context.supabase
      .from("licences")
      .select("product_slug")
      .eq("user_id", context.userId)
      .eq("status", "active");
    const slugs = (held ?? []).map((l) => l.product_slug);
    if (!slugs.length) return { slugs, status: "ok" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("licence_devices")
      .select("id, device_pubkey")
      .eq("user_id", context.userId);
    const mine = (rows ?? []).find((r) => r.device_pubkey === data.pub);
    if (mine) {
      await supabaseAdmin.from("licence_devices").update({ last_seen: new Date().toISOString(), signature_hash: data.sigHash }).eq("id", mine.id);
      return { slugs, status: "ok" as const };
    }
    if ((rows ?? []).length >= deviceLimit(slugs)) return { slugs: [], status: "limit" as const };
    await supabaseAdmin.from("licence_devices").insert({ user_id: context.userId, device_pubkey: data.pub, signature_hash: data.sigHash });
    return { slugs, status: "ok" as const };
  });
