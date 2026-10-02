import { createFileRoute, Link } from "@tanstack/react-router";
import InstallApp from "@/components/InstallApp";

const TITLE = "Enphase Operator — Wave Collapse Weather App";
const DESCRIPTION =
  "Standalone weather app from Apex Air Solutions: live conditions plus a wave-collapse engine that names the finite peak date of a warm window and how long it holds.";

export const Route = createFileRoute("/weather")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WeatherProduct,
});

const CAPABILITIES = [
  "Finite peak date — the day a warm window tops out, not a vague outlook",
  "Held-window readout: how many days stay above the seasonal normal",
  "Live observations anchor the near term; the synthesis carries the long range",
  "Measured history back-scroll and forward seasonal outlook",
  "Peak-date alerts on your phone or watch",
  "Works offline with the last view for rural and field use",
];

const ROADMAP = [
  "Animated Doppler radar and storm cell tracking",
  "Severe weather watches, warnings and advisories",
  "Hourly detail: feels-like, dew point, pressure, wind, UV, visibility, air quality",
  "Post-El Niño year potentiation band",
];

export default function WeatherProduct() {
  return (
    <main className="no-scrollbar min-h-app overflow-y-auto scan-grid px-4 py-6 text-foreground">
      <section className="mx-auto w-full max-w-3xl rounded-sm border border-signal/40 bg-card/60 p-4 sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-scan">Apex Air Solutions</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-signal sm:text-3xl">
          Enphase Operator
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A weather app that answers the question every other app dodges: exactly which day the warm
          spell peaks, and how long it holds. Sold on its own, and included with the Apex Signal
          Watch bundle.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <InstallApp />
          <Link
            to="/forecast"
            className="rounded-sm border border-signal/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-signal hover:bg-signal/10"
          >
            Open the forecast
          </Link>
          <Link
            to="/downloads"
            className="rounded-sm border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:border-scan hover:text-scan"
          >
            Downloads
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">
          How the prediction is built
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Weather is treated as overlapping waves rather than one forecast. A 30-year seasonal
          normal, the macro ocean state, the high-altitude jet meander, solar and lunar cycles, and
          historical almanac analogs are combined, and the engine solves for the finite date where
          they reinforce hardest and the rise stops.
        </p>
        <div className="mt-3 grid gap-1 sm:grid-cols-4">
          {[
            ["Rossby jet", "38%"],
            ["ENSO vector", "28%"],
            ["Almanac analogs", "20%"],
            ["Solar / lunar", "14%"],
          ].map(([label, pct]) => (
            <div key={label} className="rounded-sm border border-border bg-background/60 p-2">
              <p className="text-[9px] uppercase tracking-widest text-signal">{pct}</p>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          The weighting is published. The coefficients, phase relationships and the window-stretching
          method are not — they run on our servers and never reach your device. Enterprise deployment
          runs the same synthesis directly against raw binary model fields rather than the summarised
          feeds consumer apps rely on.
        </p>
      </section>

      <section className="mx-auto mt-4 grid w-full max-w-3xl gap-3 sm:grid-cols-2">
        <div className="rounded-sm border border-border bg-card/50 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
            In the app today
          </h2>
          <ul className="mt-2 grid gap-1.5">
            {CAPABILITIES.map((item) => (
              <li key={item} className="text-[11px] leading-relaxed text-muted-foreground">
                · {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-sm border border-warn/40 bg-card/50 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-warn">
            Landing next
          </h2>
          <ul className="mt-2 grid gap-1.5">
            {ROADMAP.map((item) => (
              <li key={item} className="text-[11px] leading-relaxed text-muted-foreground">
                · {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Buying it
        </h2>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Enphase Operator is sold on its own, and is also included in the Apex Signal Watch bundle.
          Card payment is not connected yet — installs and downloads are open in the meantime.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-sm border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-signal hover:text-signal"
          >
            See the watch bundle
          </Link>
          <Link
            to="/downloads"
            className="rounded-sm border border-signal/60 px-3 py-1.5 text-[10px] uppercase tracking-widest text-signal"
          >
            Install / download
          </Link>
        </div>
      </section>
    </main>
  );
}
