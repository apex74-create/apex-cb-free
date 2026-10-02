import { CB_ROUTES } from "@/lib/cb-routes";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import InstallApp from "@/components/InstallApp";
import heroArt from "@/assets/apex-hero.jpg";
import { listProducts, type CatalogProduct } from "@/lib/catalog.functions";
import { priceLabel, statusLabel } from "@/lib/catalog";

const TITLE = "Apex Signal Watch — Sovereign Field Kit with Wave Forecasting";
const DESCRIPTION =
  "Apex Signal Watch: a 640x320 wrist console with encrypted mesh talk, ambient signal sensing and the Enphase Operator wave-collapse weather engine built in.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://tinyradr.lovable.app/og-hero.jpg" },
      { name: "twitter:image", content: "https://tinyradr.lovable.app/og-hero.jpg" },
    ],
  }),
  // No blocking loader: the sales page must paint on a watch panel even when
  // the catalogue read is slow or fails. Products fill in afterwards.
  errorComponent: () => (
    <main className="min-h-app p-6 text-sm text-muted-foreground">
      The catalogue could not be loaded right now.{" "}
      <Link to="/app" className="text-signal underline">
        Open the tool deck
      </Link>
      .
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-app p-6 text-sm text-muted-foreground">Page not found.</main>
  ),
  component: LandingPage,
});

const PILLARS = [
  {
    title: "Carrier-blind by design",
    body: "Messages are scrambled and signed on your device before anything leaves it, so whatever carries them never sees readable content.",
  },
  {
    title: "Transport agnostic",
    body: "Mesh, radio, Wi-Fi or a hosted relay are interchangeable pipes. No single network is required and none of them are trusted.",
  },
  {
    title: "Metered and provable",
    body: "Every delivery is recorded in a signed, hash-linked ledger on the device, so what was sent and paid for can be proven later.",
  },
];

const CB_POINTS = [
  "Channels 1 to 40, the numbering everyone in a convoy or a crew already knows.",
  "Voice and text are scrambled and signed on your device with our own proprietary encryption method, so the channel carries nothing readable.",
  "Nothing about you rides in a transmission: no device type, no browser type, no account, no personal data — the frame carries only your call sign and the message.",
  "100% free as long as you agree to the coarse aggregate data collection for the research studies, which run in 90-day loops. Paid plans can pause it for a moment of anonymity, but buying in means buying into the agricultural and weather sensor array — that is the intent.",
  "No handset, no base station, no licence, no monthly airtime.",
  "Runs over mesh, Wi-Fi, radio or a relay, whichever is actually there — and every device relays for the next, so hotspots daisy-chain into a cast net with no tower at all.",
  "Falls back to the mesh when the carrier drops, which is when a CB earns its keep.",
  "Net down: the phone becomes the base station and the crew joins its own hotspot, no tower, no uplink.",
  "A desktop rides the same channel — handset push-to-talk to a Chromebook on one network is field-proven.",
  "Out of hotspot range, a licence-free LoRa radio carries the same channels one to fifteen kilometres.",
];

const INCLUDED = [
  ["Watch face", "Paints full-bleed on 640x320 and square panels with time, compass and weather."],
  ["Enphase Operator", "The wave-collapse weather engine, included with the bundle."],
  [
    "Encrypted CB",
    "Channels 1-40 with push-to-talk, scrambled and signed before it leaves the device.",
  ],
  ["Ambient sensing", "Reads the surrounding network picture with no bridge or cable needed."],
  ["Signal maps", "Dark and satellite maps with live trails and tremor overlay."],
  ["Field tools", "Packet capture control, radar, companion devices and the full tool deck."],
];

function LandingPage() {
  const { data } = useQuery<CatalogProduct[]>({
    queryKey: ["catalogue", "landing"],
    queryFn: () => listProducts(),
    staleTime: 60_000,
    retry: 1,
  });
  const products = data ?? [];
  const live = products.filter((p) => p.status === "live");
  const upcoming = products.filter((p) => p.status !== "live");

  // Big artwork is the one thing a cheap watch panel cannot hold in memory, so
  // it is only attached after the page is already painted, and never on a
  // watch-sized panel.
  const [showHero, setShowHero] = useState(false);
  useEffect(() => {
    if (document.documentElement.getAttribute("data-device") !== "watch") setShowHero(true);
  }, []);

  return (
    <main className="no-scrollbar min-h-app overflow-y-auto scan-grid px-4 py-6 text-foreground">
      <section className="mx-auto w-full max-w-3xl overflow-hidden rounded-sm border border-signal/40 bg-card/60">
        {showHero ? (
          <div className="relative border-b border-signal/20 bg-background">
            <img
              src={heroArt}
              alt="Wave collapse signal diagram"
              width={1920}
              height={1088}
              decoding="async"
              onError={() => setShowHero(false)}
              className="h-36 w-full object-cover opacity-90 sm:h-56"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          </div>
        ) : null}
        <div className="p-4 sm:p-6">
        <aside className="mb-4 rounded-sm border border-warn/50 bg-warn/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-warn">
            Free research edition
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The free radio and weather are an applied agricultural research network. Your exact
            readings stay on your device; only coarse, mixed-together numbers go to the current research studies, which run in
            90-day loops. That is the price of free use. Paid plans can pause collection for a moment of anonymity, but buying
            in means buying into the agricultural and weather sensor array — that is the intent.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to="/observe" className="rounded-sm border border-warn/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-warn hover:bg-warn/10">Ground check</Link>
            <Link to="/agreement" className="rounded-sm border border-border px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-scan hover:text-scan">The agreement</Link>
            <Link to="/store" className="rounded-sm border border-signal/60 px-3 py-1 text-[10px] uppercase tracking-widest text-signal hover:bg-signal/10">Upgrade: wideband scanner</Link>
          </div>
        </aside>
        <p className="text-[10px] uppercase tracking-[0.3em] text-scan">Apex Air Solutions</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-signal sm:text-3xl">
          Apex Signal Watch
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A sovereign field kit that lives on your wrist. Encrypted talk that does not depend on any
          one network, live signal sensing with no cable, and the Enphase Operator weather engine
          built in.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <InstallApp />
          <Link to={CB_ROUTES.entry} className="rounded-sm border border-warn/60 px-4 py-2 text-[11px] font-bold uppercase text-warn hover:bg-warn/10">Sovereign CB</Link>
          <a
            href={CB_ROUTES.face}
            className="rounded-sm border border-signal/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-signal hover:bg-signal/10"
          >
            Launch watch face
          </a>
          <Link
            to="/app"
            className="rounded-sm border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:border-scan hover:text-scan"
          >
            Open the tool deck
          </Link>
          <Link
            to="/play-readiness"
            className="rounded-sm border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:border-scan hover:text-scan"
          >
            Release checklist
          </Link>
          <Link
            to="/account"
            className="rounded-sm border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:border-scan hover:text-scan"
          >
            My licences
          </Link>
        </div>
        </div>
      </section>

      <section className="mx-auto mt-4 grid w-full max-w-3xl gap-2 sm:grid-cols-3">
        {PILLARS.map((pillar) => (
          <div key={pillar.title} className="rounded-sm border border-border bg-card/50 p-3">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-signal">
              {pillar.title}
            </h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{pillar.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">
          What comes in the bundle
        </h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {INCLUDED.map(([title, body]) => (
            <div key={title} className="rounded-sm border border-border bg-background/50 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-signal">{title}</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-scan/50 bg-card/60 p-4 sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-scan">Encrypted CB</p>
        <h2 className="mt-2 text-lg font-bold tracking-tight text-signal sm:text-xl">
          CB radio, the way it always should have worked.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Everyone on channel 19 can hear you, and always could. Apex keeps the habit and fixes the
          flaw: the same channels, the same press-to-talk, but scrambled and signed so only your
          crew can read it.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {CB_POINTS.map((line) => (
            <li key={line} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <span className="text-scan">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/ptt"
            className="rounded-sm border border-scan/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-scan hover:bg-scan/10"
          >
            Open the CB deck
          </Link>
          <Link
            to="/netchat"
            className="rounded-sm border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:border-scan hover:text-scan"
          >
            No-tower modes
          </Link>
          <Link
            to="/pricing"
            className="rounded-sm border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:border-signal hover:text-signal"
          >
            What it costs
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-4 w-full max-w-3xl">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            Products
          </h2>
          <div className="flex gap-3">
            <Link
              to="/inventory"
              className="text-[10px] uppercase tracking-widest text-scan hover:underline"
            >
              Full inventory
            </Link>
            <Link
              to="/pricing"
              className="text-[10px] uppercase tracking-widest text-scan hover:underline"
            >
              Pricing
            </Link>
            <Link
              to="/store"
              className="text-[10px] uppercase tracking-widest text-scan hover:underline"
            >
              See everything
            </Link>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {live.map((product) => (
            <Link
              key={product.slug}
              to="/store/$slug"
              params={{ slug: product.slug }}
              className="rounded-sm border border-signal/50 bg-card/60 p-3 hover:border-signal"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="truncate text-[10px] font-bold uppercase tracking-widest text-signal">
                  {product.name}
                </h3>
                <span className="text-[10px] font-bold text-signal">{priceLabel(product)}</span>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                {product.tagline}
              </p>
            </Link>
          ))}
        </div>

        {upcoming.length > 0 && (
          <div className="mt-3 rounded-sm border border-border bg-card/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              In development
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {upcoming.map((product) => (
                <Link
                  key={product.slug}
                  to="/store/$slug"
                  params={{ slug: product.slug }}
                  className="rounded-sm border border-border px-2 py-1 text-[9.5px] uppercase tracking-widest text-muted-foreground hover:border-scan hover:text-scan"
                >
                  {product.name} · {statusLabel(product.status)}
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Card payment is not connected yet. Installs and downloads are open in the meantime.
        </p>
      </section>

      <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-warn/40 bg-card/50 p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-warn">
          Patent shield
        </h2>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          The signed, metered channel method and the wave-collapse forecasting method are proprietary
          inventions of Apex Air Solutions LLC, with applications in preparation. Third-party
          components ship alongside the product under their own licences and are never compiled into
          it. Engine internals stay on our servers and are not distributed with the app.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/assembly"
            className="rounded-sm border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-warn hover:text-warn"
          >
            Component manifest
          </Link>
          <Link
            to="/privacy"
            className="rounded-sm border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-warn hover:text-warn"
          >
            Privacy
          </Link>
        </div>
      </section>
    </main>
  );
}
