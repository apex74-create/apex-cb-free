import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { listProducts, type CatalogProduct } from "@/lib/catalog.functions";
import { CATEGORY_LABEL, priceLabel, statusLabel } from "@/lib/catalog";
import BuyButton from "@/components/BuyButton";
import { productDetail } from "@/lib/product-detail";
import { papersForProduct } from "@/lib/papers";

export const Route = createFileRoute("/store/$slug")({
  loader: async ({ params }) => {
    const products = await listProducts();
    const product = products.find((p) => p.slug === params.slug);
    if (!product) throw notFound();
    // The app this one pairs with, and the bundle that carries both.
    const companion = product.companion_slug
      ? (products.find((p) => p.slug === product.companion_slug) ?? null)
      : null;
    const bundle = products.find((p) => p.slug === "apex-full-stack") ?? null;
    return { product, companion, bundle };
  },
  head: ({ loaderData }) => {
    const product = (loaderData as { product?: CatalogProduct } | undefined)?.product;
    const title = product ? `${product.name} — Apex Air Solutions` : "Apex Air Solutions";
    const description =
      product?.tagline || product?.description || "A product from Apex Air Solutions LLC.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <main className="min-h-app px-4 py-6 text-[11px] text-alert">
      This product could not be loaded. Try again shortly.
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-app px-4 py-6 text-[11px] text-muted-foreground">
      No such product.{" "}
      <Link to="/store" className="text-signal underline">
        Back to the store
      </Link>
      .
    </main>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product, companion, bundle } = Route.useLoaderData();
  const live = product.status === "live";
  const detail = productDetail(product.slug);
  const papers = papersForProduct(product.slug);

  return (
    <main className="no-scrollbar min-h-app overflow-y-auto scan-grid px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl gap-4">
        <Link
          to="/store"
          className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-signal"
        >
          ‹ Store
        </Link>
        <Link
          to="/inventory"
          className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-signal"
        >
          Inventory
        </Link>
      </div>

      <section className="mx-auto mt-2 w-full max-w-3xl rounded-sm border border-signal/40 bg-card/60 p-4 sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-scan">
          {CATEGORY_LABEL[product.category] ?? product.category}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-signal sm:text-3xl">
          {product.name}
        </h1>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{product.tagline}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-lg font-bold text-signal">{priceLabel(product)}</span>
          <span
            className={`rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-widest ${
              live ? "border-signal/60 text-signal" : "border-warn/60 text-warn"
            }`}
          >
            {statusLabel(product.status)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <BuyButton product={product} />
          {product.app_path ? (
            <a
              href={product.app_path}
              className="rounded-sm border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:border-scan hover:text-scan"
            >
              Open in the app
            </a>
          ) : null}
          {product.external_url ? (
            <a
              href={product.external_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:border-scan hover:text-scan"
            >
              Project page
            </a>
          ) : null}
        </div>
      </section>

      {companion ? (
        <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/60 p-4">
          <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
            Companion app
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {product.name} and {companion.name} are separate apps that combine into one package.
            Buy either on its own, or take both together.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/store/$slug"
              params={{ slug: companion.slug }}
              className="rounded-sm border border-scan/60 px-3 py-1.5 text-[10px] uppercase tracking-widest text-scan"
            >
              {companion.name} · {priceLabel(companion)}
            </Link>
            {bundle ? (
              <Link
                to="/store/$slug"
                params={{ slug: bundle.slug }}
                className="rounded-sm border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Both in {bundle.name} · {priceLabel(bundle)}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {detail ? (
        <>
          <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-signal/30 bg-card/50 p-4">
            <p className="text-[13px] font-bold leading-relaxed text-signal">{detail.hook}</p>
            {detail.pitch.map((para) => (
              <p key={para.slice(0, 32)} className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {para}
              </p>
            ))}
          </section>

          <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">
              Specifications
            </h2>
            <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {detail.specs.map((spec) => (
                <div key={spec.label} className="rounded-sm border border-border bg-background/40 p-2">
                  <dt className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    {spec.label}
                  </dt>
                  <dd className="mt-0.5 text-[11px] leading-relaxed text-foreground">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">
              What people use it for
            </h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {detail.useCases.map((useCase) => (
                <div key={useCase.title} className="rounded-sm border border-border bg-background/40 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-signal">
                    {useCase.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {useCase.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-warn/30 bg-card/50 p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-warn">
              What it does not do
            </h2>
            <ul className="mt-2 space-y-1">
              {detail.limits.map((limit) => (
                <li key={limit.slice(0, 32)} className="text-[11px] leading-relaxed text-muted-foreground">
                  — {limit}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {product.description ? (
        <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">
            What it does
          </h2>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        </section>
      ) : null}

      {product.unlocks.length > 0 ? (
        <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">
            What the licence unlocks
          </h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {product.unlocks.map((unlock) => (
              <li
                key={unlock}
                className="rounded-sm border border-signal/40 px-2 py-0.5 text-[9px] uppercase tracking-widest text-signal"
              >
                {unlock}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {product.downloads.length > 0 ? (
        <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">Downloads</h2>
          <ul className="mt-2 space-y-1.5">
            {product.downloads.map((download) => (
              <li
                key={download.id}
                className="rounded-sm border border-border bg-background/50 p-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-signal">
                    {download.label}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    {download.available ? download.kind : "pending"}
                  </span>
                </div>
                <p className="mt-1 break-all text-[9.5px] text-muted-foreground">
                  {download.available
                    ? download.url
                    : "Not published yet — it appears here when the signed build lands."}
                </p>
                {download.sha256 ? (
                  <p className="mt-1 break-all text-[9px] text-muted-foreground">
                    SHA-256 {download.sha256}
                  </p>
                ) : null}
                {download.requires_licence ? (
                  <p className="mt-1 text-[9px] uppercase tracking-widest text-warn">
                    Licence required
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {papers.length > 0 ? (
        <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">
            Papers behind this product
          </h2>
          <ul className="mt-2 space-y-1.5">
            {papers.map((paper) => (
              <li key={paper.slug}>
                <Link
                  to="/library/$slug"
                  params={{ slug: paper.slug }}
                  className="block rounded-sm border border-border bg-background/40 p-2.5 hover:border-signal"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10.5px] font-bold text-signal">{paper.title}</span>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                      {paper.kind}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                    {paper.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-warn/40 bg-card/50 p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-warn">
          Ownership and patent shield
        </h2>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          This product is the property of Apex Air Solutions LLC. The signed metered channel method
          and the wave-collapse forecasting method are proprietary inventions with applications in
          preparation. Engine internals are never shipped to a device or returned by any interface.
        </p>
      </section>
    </main>
  );
}
