/**
 * Download-branch paygate.
 *
 * The branch list is public; the grant is not. This resolves the signed-in
 * account's licences server-side, expands standing grants and bundles, and
 * returns only the branches that account is actually entitled to, each with
 * the licence key the branch is opened with. A browser cannot fabricate this:
 * the licence read runs as the user through row-level security.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { expandLicences, isGrantAll } from "@/lib/entitlement";
import { DOWNLOAD_BRANCHES } from "@/lib/download-branch";

export type DownloadGrant = {
  branchId: string;
  ref: string;
  /** Licence key the branch is opened with. */
  licenceKey: string;
  /** Licence that opened it — may be a standing grant rather than the product. */
  viaSlug: string;
};

export type DownloadGrantResult = {
  slugs: string[];
  grants: DownloadGrant[];
};

type Row = Record<string, unknown>;
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const nullableStr = (v: unknown): string | null => (typeof v === "string" ? v : null);

function publicClient(): SupabaseClient {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getDownloadGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DownloadGrantResult> => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const { data, error } = await supabase
      .from("licences")
      .select("product_slug, licence_key, status, expires_at, created_at")
      .eq("user_id", context.userId)
      .eq("status", "active");

    if (error) {
      console.error("download grant read failed", error.message);
      return { slugs: [], grants: [] };
    }

    let held = ((data ?? []) as Row[]).map((row) => ({
      product_slug: str(row["product_slug"]),
      licence_key: str(row["licence_key"]),
      status: str(row["status"], "active"),
      expires_at: nullableStr(row["expires_at"]),
      created_at: str(row["created_at"]),
    }));

    if (held.some((l) => isGrantAll(l.product_slug))) {
      const { data: shipping } = await publicClient()
        .from("products")
        .select("slug")
        .eq("status", "live");
      held = expandLicences(
        held,
        ((shipping ?? []) as Row[]).map((row) => str(row["slug"])),
      );
    }

    const bySlug = new Map(held.map((l) => [l.product_slug, l]));
    const grants: DownloadGrant[] = [];
    for (const branch of DOWNLOAD_BRANCHES) {
      const opener = branch.unlockedBy.find((slug) => bySlug.has(slug));
      if (!opener) continue;
      const licence = bySlug.get(opener)!;
      grants.push({
        branchId: branch.id,
        ref: branch.ref,
        licenceKey: licence.licence_key,
        viaSlug: opener,
      });
    }

    return { slugs: [...bySlug.keys()], grants };
  });
