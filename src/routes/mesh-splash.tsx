// ============= Full file contents =============
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import InstallApp from "@/components/InstallApp";
import heroArt from "@/assets/castnet-hero.jpg";
import jinnMark from "@/assets/icon-jinn.png";
import { RecentEventFloors } from "@/components/event/RecentEventFloors";

const TITLE = "Cast Net Mesh Event Builder — no-tower event mesh";
const DESCRIPTION =
  "Cast Net Mesh: the event coordinator mesh — festival floors, gate codes, vendor pickup and the no-tower mesh, part of the Apex Signal Watch field kit.";

export const Route = createFileRoute("/mesh-splash")({
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
  component: MeshSplash,
});

const POINTS = [
  "Cast Net Mesh: 3D event floors, gate codes, vendor reserve and pickup threads.",
  "No-tower modes: phones and handsets relay for each other, so the mesh works when the carrier does not.",
  "Same encrypted links as Sovereign CB — scrambled and signed on the device before anything leaves it.",
  "Weather engine built in, so the coordinator sees the sky along with the floor.",
];

export function MeshSplash({ depotHref = "/" }: { depotHref?: string } = {}) {
  // Big artwork is attached only after the page is painted, never on a
  // watch-sized panel (same rule as the depot landing page).
  const [showHero, setShowHero] = useState(false);
  useEffect(() => {
    if (document.documentElement.getAttribute("data-device") !== "watch") setShowHero(true);
  }, []);

  return (
    <main className="no-scrollbar relative min-h-app overflow-y-auto bg-background px-4 py-6 text-foreground">
      {/* Full-bleed hero behind the whole page; attached after paint, never on a watch panel. */}
      {showHero ? (
        <div aria-hidden className="pointer-events-none fixed inset-0">
          <img
            src={heroArt}
            alt="Crowd raising handsets while a person on a podium casts a glowing mesh net over an event being built"
            decoding="async"
            onError={() => setShowHero(false)}
            className="h-full w-full object-cover object-top opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          <div className="absolute inset-x-0 top-0 h-[38dvh] bg-gradient-to-b from-background from-[45%] via-background/95 via-[66%] to-transparent" />
        </div>
      ) : null}
      <div className="relative mx-auto w-full max-w-3xl pt-9 sm:pt-14">
        <h1 className="max-w-full text-4xl font-bold leading-tight text-signal sm:text-6xl">Cast Net Mesh<br /><span className="text-foreground">Event Builder</span></h1>
      </div>
      <section className="relative mx-auto flex min-h-[max(50vh,340px)] w-full max-w-3xl flex-col justify-end pb-6">
        <div className="flex items-center gap-3">
          <img
            src={jinnMark}
            alt="Jinn routing mark — signal arcs over the Arabic word jinn"
            width={1024}
            height={1024}
            className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
          />
          <p className="text-[10px] uppercase tracking-[0.3em] text-scan">Apex Air Solutions · Jinn routing</p>
        </div>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-foreground/85 sm:text-lg">
          The no-tower mesh for festivals, markets and family gatherings. Every phone is a relay,
          so the net catches signal where a tower can't.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <InstallApp />
          <Link
            to="/event"
            className="rounded-sm border border-signal bg-signal/15 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-signal hover:bg-signal/25"
          >
            Open the mesh
          </Link>
        </div>
        <nav className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <Link to="/site-map" className="hover:text-signal">Site Map</Link>
          <Link to="/netchat" className="hover:text-signal">No-tower modes</Link>
          <Link to="/pricing" className="hover:text-signal">Pricing</Link>
          <a href={depotHref} className="hover:text-scan">Full depot</a>
        </nav>
      </section>

      <div className="relative mx-auto w-full max-w-3xl"><RecentEventFloors /></div>
      <section className="relative mx-auto grid w-full max-w-3xl gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2">
        {POINTS.map((line) => (
          <div key={line} className="bg-card/85 p-4 backdrop-blur-sm">
            <p className="text-xs leading-relaxed text-muted-foreground">{line}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
