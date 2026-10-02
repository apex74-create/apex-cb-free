import { createFileRoute, Link } from "@tanstack/react-router";
import { listProducts } from "@/lib/catalog.functions";
import { CATEGORY_LABEL, priceLabel } from "@/lib/catalog";
import heroAsset from "@/assets/foundry-engine.jpg.asset.json";

const HERO = heroAsset.url;

const TITLE = "Apex Armory — Tools the field actually needs | tinyradr.com";
const DESCRIPTION =
  "Apex Engine Foundry v2.1 armory: sovereign CB comms, wave-collapse weather, field watches and security tooling. Buy once, unlock on every device.";

export const Route = createFileRoute("/store/")({
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
  loader: () => listProducts(),
  errorComponent: () => (
    <main className="min-h-app px-4 py-6 text-[11px] text-alert">
      The catalogue could not be loaded. Try again shortly.
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-app px-4 py-6 text-[11px] text-muted-foreground">Nothing here.</main>
  ),
  component: StoreIndex,
});

function StoreIndex() {
  const products = Route.useLoaderData();
  const live = products.filter((p) => p.status === "live");
  const building = products.filter((p) => p.status !== "live");

  return (
    <main className="no-scrollbar min-h-app overflow-y-auto bg-background text-foreground">
      {/* ticker */}
      <div className="border-b border-border bg-card/60 px-4 py-2 text-center text-[9.5px] font-bold uppercase tracking-[0.22em] text-warn">
        ● Foundry v2.1 online // verified software download active // early buyers keep the price they paid
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* masthead */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-sm border border-signal/60 text-[11px] font-bold text-signal">
              A▸
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">
                Apex Armory
              </p>
              <p className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
                Apex Domain Protocol // Engine Foundry v2.1
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.25em]">
            <Link to="/store" className="text-signal">Armory</Link>
            <Link to="/downloads" className="text-muted-foreground hover:text-scan">Downloads</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-scan">Pricing</Link>
            <Link to="/library" className="hidden text-muted-foreground hover:text-scan sm:inline">Protocol</Link>
            <Link
              to="/account"
              className="rounded-sm border border-warn/70 px-3 py-1.5 text-warn hover:bg-warn/10"
            >
              My licences
            </Link>
          </nav>
        </div>

        {/* hero */}
        <section className="relative flex min-h-[440px] flex-col justify-end overflow-hidden border-b border-border sm:min-h-[520px]">
          <img
            src={HERO}
            alt="Apex Engine Foundry schematic, with copper machinery driving green signal paths"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="relative z-10 max-w-2xl px-6 py-8 sm:px-10 sm:py-10">
            <span className="w-fit rounded-sm border border-signal/60 bg-signal/10 px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.25em] text-signal">
              ● Sitrep // Armory online
            </span>
            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.35em] text-scan">
              Apex Engine Foundry v2.1
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
              Tools the field
              <br />
              <span className="text-signal">actually needs.</span>
            </h1>
            <p className="mt-4 text-sm italic text-muted-foreground">
              Built from the engine up.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Operator tools, licensed in USD. Buy once — it unlocks in the app, on your devices and
              on the hardware.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#dossiers"
                className="rounded-sm bg-signal px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.25em] text-background hover:brightness-110"
              >
                ▸ Browse armory
              </a>
              <Link
                to="/pricing"
                className="rounded-sm border border-signal/70 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.25em] text-signal hover:bg-signal/10"
              >
                ▸ Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* enterprise briefing */}
        <section className="mt-6 rounded-sm border border-warn/50 bg-warn/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-warn">
            Enterprise briefing
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Apex Cell Network Growth Model — how sovereign mesh cells spawn from existing last-mile
            infrastructure (5G gateways, Starlink, public Wi-Fi, wired rural drops), why growth is
            predictable, and where edge cells will touch. For territory planning and enterprise
            evaluation.
          </p>
          <a
            href="/docs/Apex_Cell_Network_Growth_Model.docx"
            download
            className="mt-2 inline-block rounded-sm border border-warn/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-warn hover:bg-warn/10"
          >
            Download the briefing
          </a>
        </section>

        {/* dossiers */}
        <section id="dossiers" className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-scan">
                § 02 // Catalog
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Active Dossiers
              </h2>
            </div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.25em] text-warn">
              ▸ {products.length} core assemblies
            </p>
          </div>
          <div className="mt-1 h-px w-full bg-border" />

          {products.length === 0 ? (
            <p className="mt-6 rounded-sm border border-warn/40 bg-card/50 p-3 text-[11px] text-warn">
              The catalogue is empty right now. It will fill in as soon as the backend is reachable.
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...live, ...building].map((product) => (
              <article
                key={product.slug}
                className={`relative flex flex-col rounded-sm border bg-card/60 p-4 ${
                  product.status === "live" ? "border-signal/40" : "border-border"
                }`}
              >
                <span className="absolute -left-px -top-px h-2 w-2 border-l-2 border-t-2 border-signal/70" />
                <span className="absolute -bottom-px -right-px h-2 w-2 border-b-2 border-r-2 border-signal/70" />
                <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    Dossier // {CATEGORY_LABEL[product.category] ?? product.category}
                  </p>
                  {product.status === "live" ? (
                    <span className="rounded-sm border border-signal/60 px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.2em] text-signal">
                      Operational
                    </span>
                  ) : product.status === "licensed" ? (
                    <span className="rounded-sm border border-scan/60 px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.2em] text-scan">
                      Licensed
                    </span>
                  ) : (
                    <span className="rounded-sm border border-warn/60 px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.2em] text-warn">
                      In build
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.3em] text-scan">
                  Codename
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-tight text-foreground">
                  {product.name.toUpperCase()}
                </h3>
                <p className="mt-1 text-[11.5px] italic leading-relaxed text-muted-foreground">
                  {product.tagline || "Details coming soon."}
                </p>
                <div className="mt-auto pt-4">
                  <div className="flex items-end justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          product.status === "live"
                            ? "bg-signal"
                            : product.status === "licensed"
                              ? "bg-scan"
                              : "bg-warn"
                        }`}
                      />
                      {product.status === "live"
                        ? "Operational"
                        : product.status === "licensed"
                          ? "Licensed"
                          : "In build"}
                    </p>
                    <p className="text-lg font-bold tabular-nums text-signal">
                      {priceLabel(product)}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      to="/store/$slug"
                      params={{ slug: product.slug }}
                      className="flex-1 rounded-sm bg-signal px-3 py-2 text-center text-[9.5px] font-bold uppercase tracking-[0.2em] text-background hover:brightness-110"
                    >
                      ▸ {product.status === "live" || product.status === "licensed" ? "Buy licence" : "Dossier"}
                    </Link>
                    {product.status === "live" ? (
                      <Link
                        to="/store/$slug"
                        params={{ slug: product.slug }}
                        className="rounded-sm border border-border px-3 py-2 text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:border-scan hover:text-scan"
                      >
                        ▣ Dossier
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
