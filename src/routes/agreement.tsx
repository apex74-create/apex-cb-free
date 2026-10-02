import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DATA_PROMISE_TITLE,
  DATA_PROMISE_SUMMARY,
  DATA_PROMISE_POINTS,
  DATA_PROMISE_SHORT_EULA,
  GRANT_DATA_TITLE,
  GRANT_DATA_POINTS,
} from "@/lib/data-promise";
import { CURRENT_STUDIES } from "@/lib/studies";

const TITLE = "The agreement, in plain English — Apex Signal";
const DESCRIPTION =
  "One screen, readable in a minute: your fine readings stay on your device, only coarse aggregate numbers ever leave, and we never sell your location.";

export const Route = createFileRoute("/agreement")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgreementPage,
});

function AgreementPage() {
  return (
    <main className="no-scrollbar min-h-app overflow-y-auto bg-background px-4 py-8 text-foreground">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-[10px] uppercase tracking-[0.3em] text-scan">Read this in a minute</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-signal sm:text-3xl">
          {DATA_PROMISE_TITLE}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {DATA_PROMISE_SUMMARY}
        </p>

        <section className="mt-8 rounded-sm border border-signal/40 bg-signal/5 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
            What we do with what your device measures
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {DATA_PROMISE_POINTS.map((point) => (
              <li key={point} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <span className="text-signal">·</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-sm border border-warn/40 bg-warn/5 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-warn">
            {GRANT_DATA_TITLE}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {GRANT_DATA_POINTS.map((point) => (
              <li key={point} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <span className="text-warn">·</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="studies" className="mt-6 rounded-sm border border-scan/40 bg-card/40 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">Current studies</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {CURRENT_STUDIES.map((s) => (
              <li key={s.id} className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-bold text-foreground">{s.name}</span> · {s.duration}
                <br />
                Collects: {s.collects}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Study Partner plans lock in their price for the length of a study while the account keeps contributing. Contact us for terms.
          </p>
        </section>

        <section className="mt-6 rounded-sm border border-border/60 bg-card/40 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">
            The whole agreement
          </h2>
          <ol className="mt-3 flex flex-col gap-3">
            {DATA_PROMISE_SHORT_EULA.map((line, i) => (
              <li key={line} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
                <span className="tabular-nums text-scan">{i + 1}.</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            That is the agreement. There is no longer version that quietly says something else. If
            we ever need to change it, the change appears on this page before it takes effect.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3 text-[10px] uppercase tracking-widest">
          <Link to="/privacy" className="rounded-sm border border-border px-3 py-2 text-scan">
            Privacy detail
          </Link>
          <Link to="/pricing" className="rounded-sm border border-border px-3 py-2 text-scan">
            Pricing
          </Link>
          <Link to="/" className="rounded-sm border border-border px-3 py-2 text-muted-foreground">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
