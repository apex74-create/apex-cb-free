import { CB_OG_IMAGE } from "@/lib/cb-routes";
import { APP_DOMAINS, TOYS } from "@/lib/app-routes";
import uapWallpaper from "@/assets/uap-station-wallpaper.jpg";
import ghostWallpaper from "@/assets/ghost-station-wallpaper.jpg";
import mysticWallpaper from "@/assets/mystic-nine-wallpaper.jpg";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import InstallApp from "@/components/InstallApp";
import IphoneSafariInstallGuide from "@/components/IphoneSafariInstallGuide";
import FreeInstallCount from "@/components/FreeInstallCount";
import heroArt from "@/assets/apex-hero.jpg";
import shieldHeroArt from "@/assets/sovereign-hero.jpg";
import { Button } from "@/components/ui/button";
import WatchOffer from "@/components/WatchOffer";
import { MeshSplash } from "@/routes/mesh-splash";
import { CbSplash } from "@/routes/cb-splash";
import { resolveHost, type HostInfo } from "@/lib/host.functions";
import { useOwnedSlugs, previewPassOpen, startPreviewPass } from "@/lib/use-owned-apps";

const TITLE = "Apex Signal Watch — 7-Day Trial | Tiny Radar";
const DESCRIPTION =
  "Apex Signal Watch: one wrist-ready app with push-to-talk, basic 40-channel CB and free weather. Seven-day trial, then a $9.99 one-time licence. Operator tools require a separate licence.";

export const Route = createFileRoute("/")({
  // Each domain paints its own page and its own share card on first load.
  head: ({ loaderData }) => {
    const app = (loaderData as HostInfo | undefined)?.app ?? null;
    if (app === "cb") return metaFor(CB_TITLE, CB_DESCRIPTION, CB_OG_IMAGE);
    if (app === "mesh") return metaFor(MESH_TITLE, MESH_DESCRIPTION, null);
    if (app === "shield") return metaFor(SHIELD_TITLE, SHIELD_DESCRIPTION, null);
    return metaFor(TITLE, DESCRIPTION, "https://tinyradr.com/og-hero.jpg");
  },
  // The entrance paints without waiting on the catalogue.
  errorComponent: () => (
    <main className="min-h-app p-6 text-sm text-muted-foreground">
      The Watch page could not be loaded right now.{" "}
      <Link to="/face" className="text-signal underline">
        Open Signal Watch
      </Link>
      .
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-app p-6 text-sm text-muted-foreground">Page not found.</main>
  ),
  loader: () => resolveHost(),
  component: LandingPage,
});

const CB_TITLE = "Encrypted CB — Sovereign CB, free to start";
const CB_DESCRIPTION =
  "Sovereign CB: push-to-talk CB with encrypted digital links, private rooms, scanner and weather — free to start, paid tiers for crews and sites.";
const MESH_TITLE = "Cast Net Mesh — the no-tower event mesh";
const MESH_DESCRIPTION =
  "Cast Net Mesh: event floors, gate codes, vendor pickup and phone-to-phone relay — the mesh that works where the tower does not.";
const SHIELD_TITLE = "Apex Signal Shield — Free Dashboard & Map";
const SHIELD_DESCRIPTION = "Explore the free Shield dashboard and basic map. Connected signal instruments are separate and await hardware validation; free CB and weather remain available.";

function metaFor(title: string, description: string, image: string | null) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(image
        ? [
            { property: "og:image", content: image },
            { name: "twitter:image", content: image },
          ]
        : []),
    ],
  };
}

function LandingPage() {
  // castnetmesh.com and encryptedcb.com each open on their own splash; the
  // domain is known on the server, so the right page is the first paint.
  const host = Route.useLoaderData() as HostInfo | undefined;
  const splashHost = host?.app ?? null;
  // Attach the large artwork after first paint, except on a physical watch.
  const [showHero, setShowHero] = useState(false);
  const owned = useOwnedSlugs();
  const isOwner = !!owned && owned.length > 0;
  const [passOpen, setPassOpen] = useState(true);
  useEffect(() => setPassOpen(previewPassOpen()), []);
  useEffect(() => {
    if (window.innerWidth > 480 || document.documentElement.getAttribute("data-device") !== "watch") setShowHero(true);
  }, []);

  if (splashHost === "mesh") return <MeshSplash depotHref={APP_DOMAINS.depot} />;
  if (splashHost === "cb") return <CbSplash depotHref={APP_DOMAINS.depot} />;
  if (splashHost === "shield") return (
    <main className="relative flex min-h-app flex-col items-center justify-center gap-6 overflow-hidden bg-background px-6 text-center">
      <img src={shieldHeroArt} alt="" aria-hidden width={1920} height={1080} decoding="async" className="absolute inset-0 h-full w-full object-cover object-[68%_center]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/85 via-background/55 to-background" />
      <img src="/icons/shield-512.png" alt="Apex Signal Shield badge" width={512} height={512} className="relative w-56 max-w-[70vw] drop-shadow-[0_0_40px_hsl(var(--signal)/0.45)] sm:w-72" />
      <div className="relative space-y-2">
        <h1 className="text-3xl font-bold tracking-wide text-signal drop-shadow-[0_2px_12px_hsl(var(--background)/0.9)] sm:text-4xl">Apex Signal Shield</h1>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Tremor map engine · Defense Ops</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground drop-shadow-[0_1px_8px_hsl(var(--background)/0.9)]">Own the dash. Works offline with a regional map cache. Plug in your Bruce CYD for the connected tools.</p>
      </div>
      <Button asChild size="lg" className="relative"><Link to="/shield">Enter the Shield</Link></Button>
      <div className="relative w-full max-w-xs"><InstallApp /></div>
    </main>
  );


  return (
    <main className="no-scrollbar min-h-app overflow-y-auto bg-background text-foreground">
      <section className="relative mx-auto w-full max-w-6xl overflow-hidden border-b border-signal/40">
        {showHero && <div className="relative h-[min(65svh,680px)] min-h-72 overflow-hidden">
          <img src={heroArt} alt="Apex Signal Watch radar rings and glowing signal wave" width={1920} height={1088} decoding="async" onError={() => setShowHero(false)} className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-6 sm:px-9 sm:pb-9">
            <p className="text-[10px] font-bold uppercase text-scan">Tiny Radar · Apex Air Solutions</p>
            <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-5xl">Apex Signal Watch</h1>
          </div>
        </div>}
        {!showHero && <h1 className="px-5 pt-10 text-3xl font-bold text-signal">Apex Signal Watch</h1>}
        <div className="px-5 pb-8 pt-4 sm:px-9">
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">One field-ready watch app: push-to-talk intercom, encrypted digital links, a basic 40-channel CB deck and free weather. The free CB edition has 20 channels; more CB capability is sold separately in the CB app.</p>
          {isOwner ? (
            <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-border py-5">
              <p className="w-full text-xs uppercase tracking-widest text-scan">Licence recognized on this device</p>
              <Button asChild size="lg"><Link to="/app">Open Signal Watch</Link></Button>
              <InstallApp />
            </div>
          ) : (<>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-border py-5">
            <div className="min-w-36"><p className="text-2xl font-bold text-signal">7 days</p><p className="text-xs text-muted-foreground">free trial</p></div>
            <div className="min-w-36"><p className="text-2xl font-bold text-foreground">$9.99</p><p className="text-xs text-muted-foreground">one-time Watch licence</p></div>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">The Watch licence does not include the full operator licence or the expanded CB app.</p>
          </div>
          <WatchOffer />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {passOpen
              ? <Button asChild variant="outline"><Link to="/face" onClick={startPreviewPass}>Preview watch face · 24 h</Link></Button>
              : <p className="text-xs text-muted-foreground">Your 24-hour preview has ended. Start the 7-day trial to keep using it.</p>}
            <InstallApp />
          </div>
          <div className="mt-3"><FreeInstallCount /></div>
          </>)}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-px border-b border-border px-5 py-8 sm:grid-cols-3 sm:px-9">
        <div className="py-3 sm:pr-6"><h2 className="text-sm font-bold text-signal">Talk</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Push-to-talk intercom and basic CB channels live together on the watch.</p></div>
        <div className="border-t border-border py-3 sm:border-l sm:border-t-0 sm:px-6"><h2 className="text-sm font-bold text-scan">Weather</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Free weather readings belong in the same field view.</p></div>
        <div className="border-t border-border py-3 sm:border-l sm:border-t-0 sm:pl-6"><h2 className="text-sm font-bold text-warn">Signal</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">A compact signal face that scales from a wrist to your phone or tablet.</p></div>
      </section>
      <section aria-labelledby="field-toys" className="mx-auto max-w-6xl border-b border-border px-5 py-8 sm:px-9">
        <h2 id="field-toys" className="text-sm font-bold uppercase tracking-widest text-signal">Field toys</h2>
        <p className="mt-1 text-xs text-muted-foreground">Real phone sensors, local only. $9.99 each.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([
            { to: TOYS.uap, title: "UAP Field Station", line: "Magnetic, light and sound anomaly logger", img: uapWallpaper },
            { to: TOYS.ghost, title: "Halloween Ghost Station", line: "Night-session detector with sound pictures", img: ghostWallpaper },
            { to: TOYS.mystic, title: "Mystic 9 Ball", line: "Three, six, nine — ask and observe", img: mysticWallpaper },
          ] as const).map((toy) => (
            <Link key={toy.to} to={toy.to} className="group relative block h-40 overflow-hidden rounded-lg border border-border">
              <img src={toy.img} alt="" loading="lazy" width={1280} height={960} className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 bg-background/80 p-3 backdrop-blur-sm">
                <p className="text-sm font-bold text-foreground">{toy.title}</p>
                <p className="text-[11px] text-muted-foreground">{toy.line}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <div className="mx-auto mt-8 max-w-6xl px-5 pb-8 sm:px-9"><IphoneSafariInstallGuide /></div>
    </main>
  );
}
