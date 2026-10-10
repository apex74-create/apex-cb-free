// ============= Full file contents =============
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import InstallApp from "@/components/InstallApp";
import heroArt from "@/assets/hero-wrist-castnet.jpg";

const TITLE = "Encrypted CB — Sovereign CB, free to start";
const DESCRIPTION =
  "Sovereign CB: push-to-talk CB with encrypted digital links, private rooms, scanner and weather — free to start, paid tiers for crews and sites.";

export const Route = createFileRoute("/cb-splash")({
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
  component: CbSplash,
});

const POINTS = [
  "Push-to-talk CB that runs in the browser — no tower, no carrier, works on handsets, watches and desktops.",
  "Digital links are scrambled and signed on your device before anything leaves it; cable-fed 27 MHz audio stays plain under Part 95.",
  "Private rooms with device-bound invites, a channel scanner, and call history you keep.",
  "Weather engine built in — the same sky the depot uses, right on the CB deck.",
];

export function CbSplash({ depotHref = "/" }: { depotHref?: string } = {}) {
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
            alt="Operator keying a wrist communicator on channel 19, casting an electronic mesh net over a drone zone with a CB tower behind"
            decoding="async"
            onError={() => setShowHero(false)}
            className="h-full w-full object-cover object-center opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        </div>
      ) : null}
      <section className="relative mx-auto mt-[28vh] w-full max-w-3xl overflow-hidden rounded-sm border border-signal/40 bg-card/70 backdrop-blur-sm">
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-scan">Apex Air Solutions</p>
            <span className="rounded-sm border-2 border-warn bg-warn/15 px-3 py-1 text-xs font-black uppercase tracking-widest text-warn" aria-label="Channel 19">CH 19 · Urban CB</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-signal sm:text-3xl">
            Sovereign CB
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The CB for families, crews and field hands. Free to start — key up, talk, and let the
            other person finish, like back in the day.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <InstallApp />
            <Link
              to="/cb"
              className="rounded-sm border border-warn/60 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-warn hover:bg-warn/10"
            >
              Key up free
            </Link>
            <Link
              to="/pricing"
              className="rounded-sm border border-signal/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-signal hover:bg-signal/10"
            >
              Paid tiers
            </Link>
            <a
              href={depotHref}
              className="rounded-sm border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:border-scan hover:text-scan"
            >
              The full depot
            </a>
          </div>
        </div>
      </section>

      <section className="relative mx-auto mt-4 grid w-full max-w-3xl gap-2 sm:grid-cols-2">
        {POINTS.map((line) => (
          <div key={line} className="rounded-sm border border-border bg-card/70 p-3 backdrop-blur-sm">
            <p className="text-[11px] leading-relaxed text-muted-foreground">{line}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
