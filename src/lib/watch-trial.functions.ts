import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WATCH = "apex-signal-watch";

export const startWatchTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readError } = await supabaseAdmin.from("licences")
      .select("source, status, expires_at")
      .eq("user_id", context.userId).eq("product_slug", WATCH).maybeSingle();
    if (readError) throw new Error("Could not check your Watch access.");
    if (existing) return { state: existing.source === "trial" ? "trial" : existing.status === "active" ? "owned" : "inactive", expiresAt: existing.expires_at };

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("licences").insert({
      user_id: context.userId, product_slug: WATCH,
      licence_key: `WATCH-TRIAL-${crypto.randomUUID()}`,
      source: "trial", status: "active", expires_at: expiresAt,
    });
    if (error) {
      // The unique account/product key also protects against simultaneous or repeated starts.
      const { data: concurrent } = await supabaseAdmin.from("licences")
        .select("source, expires_at").eq("user_id", context.userId).eq("product_slug", WATCH).maybeSingle();
      if (concurrent) return { state: concurrent.source === "trial" ? "trial" : "owned", expiresAt: concurrent.expires_at };
      throw new Error("The Watch trial could not be started. Please try again.");
    }
    return { state: "trial", expiresAt };
  });