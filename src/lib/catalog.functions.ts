// Community build: product catalog and licence reads are not available.
// Store pages render empty until the community catalog lands.
import { createServerFn } from "@tanstack/react-start";

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

export const listProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogProduct[]> => [],
);

export const listMyLicences = createServerFn({ method: "GET" }).handler(
  async (): Promise<Licence[]> => [],
);
