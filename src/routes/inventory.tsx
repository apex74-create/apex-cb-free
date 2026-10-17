/**
 * One inventory page: every product across every repository, with the
 * signed-in customer's licences laid over the top.
 *
 * The catalogue is public data read during SSR; licences are user-owned and
 * fetched client-side through the authenticated server function, so a browser
 * can never fabricate ownership.
 */

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listProducts, listMyLicences, type CatalogProduct } from "@/lib/catalog.functions";
import { CATEGORY_LABEL, priceLabel, statusLabel } from "@/lib/catalog";
import { useSession } from "@/lib/cloud";

const TITLE = "Inventory — Apex Air Solutions";
const DESCRIPTION =
  "Every Apex Air Solutions product on one page: what it is, what it costs, where it runs and whether you already own it.";

export const Route = createFileRoute("/inventory")({
  loader: async (): Promise<CatalogProduct[]> => await listProducts(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <main className="min-h-app px-4 py-6 text-[11px] text-alert">
      The inventory could not be loaded right now.{" "}
      <Link to="/store" className="underline">
        Open the store
      </Link>
      .
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-app px-4 py-6 text-[11px] text-muted-foreground">Nothing here.</main>
  ),
  component: InventoryPage,
});

function runsWhere(product: CatalogProduct): string {
  if (product.app_path) return `In this app · ${product.app_path}`;
  if (product.external_url?.startsWith("http") && !product.external_url.includes("github.com")) {
    return "Separate site";
  }
  if (product.category === "firmware" || product.category === "hardware") return "On hardware";
  if (product.category === "internal") return "Internal record";
  return "Not deployed yet";
}

function InventoryPage() {
  const products = Route.useLoaderData();
  const { session } = useSession();
  const fetchLicences = useServerFn(listMyLicences);

  const licences = useQuery({
    queryKey: ["my-licences", session?.user.id ?? "anon"],
    queryFn: () => fetchLicences(),
    enabled: Boolean(session),
  });

  const owned = useMemo(
    () => new Set((licences.data ?? []).map((l) => l.product_slug)),
    [licences.data],
  );

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "live" | "coming_soon">("all");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) =>
        needle === ""
          ? true
          : `${p.name} ${p.tagline} ${p.repo ?? ""} ${p.category}`.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [products, query, status]);

  const liveCount = products.filter((p) => p.status === "live").length;

  return (
    <main className="no-scrollbar min-h-app overflow-y-auto scan-grid px-4 py-6 text-foreground">
      <section className="mx-auto w-full max-w-5xl rounded-sm border border-signal/40 bg-card/60 p-4 sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-scan">Apex Air Solutions</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-signal sm:text-3xl">Inventory</h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
          Everything built across every repository, on one page. {liveCount} available now,{" "}
          {products.length - liveCount} in development.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-[10px] uppercase tracking-widest">
          <Link to="/" className="text-muted-foreground hover:text-signal">
            Home
          </Link>
          <Link to="/store" className="text-muted-foreground hover:text-signal">
            Store
          </Link>
          <Link to="/account" className="text-muted-foreground hover:text-signal">
            My licences
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-4 flex w-full max-w-5xl flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search by name, repository or category"
          aria-label="Search the inventory"
          className="min-w-[220px] flex-1 rounded-sm border border-border bg-background/60 px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-signal focus:outline-none"
        />
        {(["all", "live", "coming_soon"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-sm border px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${
              status === s
                ? "border-signal text-signal"
                : "border-border text-muted-foreground hover:border-scan hover:text-scan"
            }`}
          >
            {s === "all" ? "Everything" : s === "live" ? "Available" : "In development"}
          </button>
        ))}
      </section>

      <section className="mx-auto mt-3 w-full max-w-5xl space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-sm border border-border bg-card/50 p-4 text-[11px] text-muted-foreground">
            Nothing matches that search.
          </p>
        ) : null}

        {rows.map((product) => {
          const live = product.status === "live";
          const isOwned = owned.has(product.slug);
          return (
            <article
              key={product.id}
              className="rounded-sm border border-border bg-card/50 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  to="/store/$slug"
                  params={{ slug: product.slug }}
                  className="text-[13px] font-bold text-signal hover:underline"
                >
                  {product.name}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  {isOwned ? (
                    <span className="rounded-sm border border-signal/60 px-2 py-0.5 text-[9px] uppercase tracking-widest text-signal">
                      Owned
                    </span>
                  ) : null}
                  <span
                    className={`rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-widest ${
                      live ? "border-signal/60 text-signal" : "border-warn/60 text-warn"
                    }`}
                  >
                    {statusLabel(product.status)}
                  </span>
                  <span className="text-[12px] font-bold text-signal">{priceLabel(product)}</span>
                </div>
              </div>

              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {product.tagline}
              </p>

              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[9.5px] uppercase tracking-widest text-muted-foreground sm:grid-cols-3">
                <div>
                  <dt className="inline text-scan">Category </dt>
                  <dd className="inline">{CATEGORY_LABEL[product.category] ?? product.category}</dd>
                </div>
                <div>
                  <dt className="inline text-scan">Runs </dt>
                  <dd className="inline normal-case tracking-normal">{runsWhere(product)}</dd>
                </div>
                <div>
                  <dt className="inline text-scan">Source </dt>
                  <dd className="inline normal-case tracking-normal">
                    {product.repo
                      ? product.repo_public
                        ? product.repo
                        : `${product.repo} (private)`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </section>

      <section className="mx-auto mt-4 w-full max-w-5xl rounded-sm border border-warn/40 bg-card/50 p-4">
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Card payment is not connected yet, so nothing can be bought on this page. Private
          repositories are listed by name only and never linked. Internal records and work folded
          into a shipping product are kept out of this list.
        </p>
      </section>
    </main>
  );
}
