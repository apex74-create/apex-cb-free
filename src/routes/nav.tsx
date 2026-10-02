import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * Apex Signal Watch — the position and instruments app's own front door.
 *
 * Watch face, location, sextant and compass, sold and opened on its own. It
 * knows its companion (Enphase Operator) and says so: owning both is a package.
 */

export const Route = createFileRoute("/nav")({
  component: NavHome,
  head: () => ({
    meta: [
      { title: "Apex Signal Watch — Position, Sextant, Compass" },
      {
        name: "description",
        content:
          "Apex Signal Watch: a watch face, position without a tower, a working sextant and a compass, on watch, phone or tablet.",
      },
      { property: "og:title", content: "Apex Signal Watch — Position, Sextant, Compass" },
      {
        property: "og:description",
        content:
          "Watch face, tower-free position, sextant and compass in one install that fits a watch, a phone or a tablet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TILES = [
  { to: "/face", label: "Watch face", note: "signal face · always on" },
  { to: "/map", label: "Position", note: "where you are" },
] as const;

function NavHome() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="rounded-sm border border-border bg-card/60 p-4">
        <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
          Apex Air Solutions
        </p>
        <h1 className="mt-1 text-lg font-bold uppercase tracking-[0.2em] text-signal">
          Apex Signal Watch
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          The face, your position, a working sextant and a compass. One install that fits a watch, a
          phone or a tablet, and keeps working with the towers down.
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
          Enphase Operator adds wave-collapse forecasting, radar and the field array. Own both and
          they run as one package.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/wx"
            className="rounded-sm border border-signal/60 px-3 py-1.5 text-[9px] uppercase tracking-widest text-signal"
          >
            Open Enphase Operator
          </Link>
          <Link
            to="/store/$slug"
            params={{ slug: "apex-signal-watch" }}
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
