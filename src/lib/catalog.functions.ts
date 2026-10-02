/**
 * Product catalogue + licence reads.
 *
 * The catalogue is public data: it renders during SSR through the publishable
 * key with a narrow `TO anon` SELECT policy. Licences are user-owned and go
 * through `requireSupabaseAuth`, so a browser can never fabricate ownership.
 *
 * These tables are newer than the generated Database types, so the clients
 * here are deliberately untyped and the rows are narrowed by hand.
 */

import { createServerFn } from "@tanstack/react-start";
import { expandLicences, isGrantAll } from "@/lib/entitlement";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CatalogDownload = {
  id: string;
  label: string;
  kind: string;
  url: string;
  version: string | null;
  size_bytes: number | null;
  sha256: string | null;
  requires_licence: boolean;
  available: boolean;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price_usd: number | null;
  category: string;
  status: string;
  unlocks: string[];
  repo: string | null;
  repo_public: boolean;
  external_url: string | null;
  app_path: string | null;
  /** The app this one pairs with; owning both makes a package. */
  companion_slug: string | null;
  featured: boolean;
  sort_order: number;
  downloads: CatalogDownload[];
};

export type Licence = {
  product_slug: string;
  licence_key: string;
  status: string;
  expires_at: string | null;
  created_at: string;
};

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const nullableStr = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const bool = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);

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

function toDownload(row: Row): CatalogDownload {
  return {
    id: str(row["id"]),
    label: str(row["label"]),
    kind: str(row["kind"], "download"),
    url: str(row["url"]),
    version: nullableStr(row["version"]),
    size_bytes: num(row["size_bytes"]),
    sha256: nullableStr(row["sha256"]),
    requires_licence: bool(row["requires_licence"], true),
    available: bool(row["available"]),
  };
}

function toProduct(row: Row, downloads: CatalogDownload[]): CatalogProduct {
  const unlocks = row["unlocks"];
  return {
    id: str(row["id"]),
    slug: str(row["slug"]),
    name: str(row["name"]),
    tagline: str(row["tagline"]),
    description: str(row["description"]),
    price_usd: num(row["price_usd"]),
    category: str(row["category"], "software"),
    status: str(row["status"], "coming_soon"),
    unlocks: Array.isArray(unlocks) ? unlocks.filter((u): u is string => typeof u === "string") : [],
    repo: nullableStr(row["repo"]),
    repo_public: bool(row["repo_public"]),
    external_url: nullableStr(row["external_url"]),
    app_path: nullableStr(row["app_path"]),
    companion_slug: nullableStr(row["companion_slug"]),
    featured: bool(row["featured"]),
    sort_order: num(row["sort_order"]) ?? 100,
    downloads,
  };
}

/** Everything in the catalogue. Safe for anonymous use and SSR. */
export const listProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogProduct[]> => {
    const supabase = publicClient();
    const [productRes, downloadRes] = await Promise.all([
      supabase.from("products").select("*").order("sort_order", { ascending: true }),
      supabase.from("product_downloads").select("*").order("sort_order", { ascending: true }),
    ]);

    if (productRes.error) {
      console.error("catalogue read failed", productRes.error.message);
      return [];
    }

    const byProduct = new Map<string, CatalogDownload[]>();
    for (const raw of (downloadRes.data ?? []) as Row[]) {
      const key = str(raw["product_id"]);
      const list = byProduct.get(key) ?? [];
      list.push(toDownload(raw));
      byProduct.set(key, list);
    }

    return ((productRes.data ?? []) as Row[]).map((row) =>
      toProduct(row, byProduct.get(str(row["id"])) ?? []),
    );
  },
);

/** The signed-in customer's licences. Never trusted from the client. */
export const listMyLicences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Licence[]> => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const { data, error } = await supabase
      .from("licences")
      .select("product_slug, licence_key, status, expires_at, created_at")
      .eq("user_id", context.userId)
      .eq("status", "active");

    if (error) {
      console.error("licence read failed", error.message);
      return [];
    }

    const held = ((data ?? []) as Row[]).map((row) => ({
      product_slug: str(row["product_slug"]),
      licence_key: str(row["licence_key"]),
      status: str(row["status"], "active"),
      expires_at: nullableStr(row["expires_at"]),
      created_at: str(row["created_at"]),
    }));

    // A standing grant covers products released after the purchase, so the
    // shipping list is resolved now rather than frozen at checkout.
    if (!held.some((l) => isGrantAll(l.product_slug))) return held;

    const { data: shipping } = await publicClient()
      .from("products")
      .select("slug")
      .eq("status", "live");
    const slugs = ((shipping ?? []) as Row[]).map((row) => str(row["slug"]));
    return expandLicences(held, slugs);
  });
