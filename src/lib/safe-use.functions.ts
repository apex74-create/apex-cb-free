import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Dated safe-use policy. Bump the date to force everyone to re-accept. */
export const SAFE_USE_POLICY_VERSION = "2026-09-30";
export const SAFE_USE_PACK = "radiolab";

export const getSafeUseStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("safe_use_attestations")
      .select("accepted_at, policy_version")
      .eq("pack", SAFE_USE_PACK)
      .eq("policy_version", SAFE_USE_POLICY_VERSION)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      accepted: Boolean(data),
      acceptedAt: data?.accepted_at ?? null,
      policyVersion: SAFE_USE_POLICY_VERSION,
    };
  });

export const acceptSafeUse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ confirm: z.literal(true) }).parse(d))
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("safe_use_attestations").insert({
      user_id: context.userId,
      pack: SAFE_USE_PACK,
      policy_version: SAFE_USE_POLICY_VERSION,
      accepted_at: new Date().toISOString(),
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { accepted: true, policyVersion: SAFE_USE_POLICY_VERSION };
  });
