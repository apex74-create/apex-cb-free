import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * Enphase Operator — the weather app's own front door.
 *
 * Sold and opened on its own, it stands alone: forecast, radar, live readings
 * and the field array. It also knows its companion (Apex Signal Watch) and
 * says so, because owning both is a package.
 */

export const Route = createFileRoute("/wx")({
  component: WeatherHome,
  head: () => ({
    meta: [
      { title: "Enphase Operator — Wave Collapse Weather" },
      {
        name: "description",
        content:
          "Enphase Operator: wave-collapse long-range forecasting, Doppler radar, live conditions and a shared field sensor array, in one app.",
      },
      { property: "og:title", content: "Enphase Operator — Wave Collapse Weather" },
      {
        property: "og:description",
        content:
          "Long-range wave-collapse forecasting with Doppler radar, live conditions and a crowd-measured sensor array.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TILES = [
  { to: "/forecast", label: "Forecast", note: "wave collapse · 62 days" },
  { to: "/doppler", label: "Doppler", note: "two hours of radar" },
  { to: "/array", label: "Field array", note: "live stations near you" },
  { to: "/astro", label: "Solar · lunar", note: "almanac and quakes" },
  { to: "/map", label: "Map", note: "pick a location" },
] as const;

function WeatherHome() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="rounded-sm border border-border bg-card/60 p-4">
        <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
          Apex Air Solutions
        </p>
        <h1 className="mt-1 text-lg font-bold uppercase tracking-[0.2em] text-signal">
          Enphase Operator
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Wave-collapse forecasting to the horizon, radar for the next hour, and a live array of
          stations measuring the air and the radio around you.
        </p>
      </header>

      <nav className="mt-4 grid grid-cols-2 gap-2">
        {TILES.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="rounded-sm border border-border bg-card/60 px-3 py-4 active:bg-accent"
          >
            <span className="block text-[11px] font-bold uppercase tracking-widest text-signal">
              {tile.label}
            </span>
            <span className="mt-1 block text-[9px] uppercase tracking-widest text-muted-foreground">
              {tile.note}
            </span>
          </Link>
        ))}
      </nav>

      <section className="mt-4 rounded-sm border border-border bg-card/60 p-3">
        <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Companion app</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Apex Signal Watch adds the watch face, position, sextant and compass. Own both and they
          run as one package.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/nav"
            className="rounded-sm border border-signal/60 px-3 py-1.5 text-[9px] uppercase tracking-widest text-signal"
          >
            Open Apex Signal
          </Link>
          <Link
            to="/store/$slug"
            params={{ slug: "enphase-operator" }}
            className="rounded-sm border border-border px-3 py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground"
          >
            Licence this app
          </Link>
          <Link
            to="/store/$slug"
            params={{ slug: "apex-full-stack" }}
            className="rounded-sm border border-border px-3 py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground"
          >
            Both as a package
          </Link>
        </div>
      </section>
    </main>
  );
}
