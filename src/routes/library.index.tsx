import { createFileRoute, Link } from "@tanstack/react-router";
import { PAPERS, PAPER_KIND_ORDER } from "@/lib/papers";

export const Route = createFileRoute("/library/")({
  head: () => ({
    meta: [
      { title: "Paper library — Apex Air Solutions" },
      {
        name: "description",
        content:
          "Every Apex white paper, patent draft, provenance record and repository note in one index: what each covers, its state, and the product it backs.",
      },
      { property: "og:title", content: "Paper library — Apex Air Solutions" },
      {
        property: "og:description",
        content:
          "White papers, patent drafts, provenance records and repository notes behind the Apex product line.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const groups = PAPER_KIND_ORDER.map((kind) => ({
    kind,
    papers: PAPERS.filter((p) => p.kind === kind),
  })).filter((g) => g.papers.length > 0);

  return (
    <main className="min-h-dvh bg-background px-4 py-8">
      <header className="mx-auto w-full max-w-4xl rounded-sm border border-border bg-card/60 p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-scan">
          Apex Air Solutions
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Paper library</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every white paper, patent draft, provenance record and repository note behind the product
          line, boiled down to what it covers and what it backs. Open any one to read the published
          version; the full originals live beside the code they describe.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-sm border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-scan hover:text-scan"
          >
            Home
          </Link>
          <Link
            to="/inventory"
            className="rounded-sm border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-scan hover:text-scan"
          >
            Inventory
          </Link>
          <Link
            to="/store"
            className="rounded-sm border border-signal/60 px-3 py-1.5 text-[10px] uppercase tracking-widest text-signal hover:bg-signal/10"
          >
            Store
          </Link>
        </div>
      </header>

      {groups.map((group) => (
        <section key={group.kind} className="mx-auto mt-6 w-full max-w-4xl">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            {group.kind}
          </h2>
          <div className="grid gap-2">
            {group.papers.map((paper) => (
              <Link
                key={paper.slug}
                to="/library/$slug"
                params={{ slug: paper.slug }}
                className="block rounded-sm border border-border bg-card/40 p-4 hover:border-signal/60"
              >
                <h3 className="text-sm font-bold">{paper.title}</h3>
                <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                  {paper.summary}
                </p>
                <dl className="mt-3 grid gap-1 text-[10px] uppercase tracking-widest text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="inline text-muted-foreground/70">State </dt>
                    <dd className="inline text-warn">{paper.status}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground/70">Source </dt>
                    <dd className="inline font-mono normal-case tracking-normal">{paper.source}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-[10px] uppercase tracking-widest text-signal">Read ›</p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="mx-auto mt-6 w-full max-w-4xl rounded-sm border border-warn/40 bg-card/50 p-4">
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          These are attorney-review drafts and engineering records — not filings, not patentability
          opinions, not safety certifications. Nothing in the product line is described as patented
          until a filing exists. Engine parameters, signing keys and customer records never appear
          in any published paper.
        </p>
      </section>
    </main>
  );
}
