import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { paperBySlug, type Paper } from "@/lib/papers";

export const Route = createFileRoute("/library/$slug")({
  loader: ({ params }) => {
    const paper = paperBySlug(params.slug);
    if (!paper) throw notFound();
    return paper;
  },
  head: ({ loaderData }) => {
    const paper = loaderData as Paper | undefined;
    const title = paper ? `${paper.title} — Apex papers` : "Apex papers";
    const description = paper?.summary ?? "A document from the Apex Air Solutions paper library.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="min-h-dvh bg-background px-4 py-8 text-[11px] text-muted-foreground">
      No such paper.{" "}
      <Link to="/library" className="text-signal underline">
        Back to the library
      </Link>
      .
    </main>
  ),
  component: PaperPage,
});

function PaperPage() {
  const paper = Route.useLoaderData();

  return (
    <main className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/library"
          className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-signal"
        >
          ‹ Paper library
        </Link>
      </div>

      <article className="mx-auto mt-2 w-full max-w-3xl rounded-sm border border-signal/40 bg-card/60 p-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-scan">{paper.kind}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-signal sm:text-3xl">
          {paper.title}
        </h1>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{paper.summary}</p>
        <dl className="mt-4 grid gap-1 text-[10px] uppercase tracking-widest text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="inline text-muted-foreground/70">State </dt>
            <dd className="inline text-warn">{paper.status}</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground/70">Dated </dt>
            <dd className="inline">{paper.dated}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="inline text-muted-foreground/70">Source </dt>
            <dd className="inline font-mono normal-case tracking-normal">
              {paper.sourceUrl ? (
                <a
                  href={paper.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-scan underline"
                >
                  {paper.source}
                </a>
              ) : (
                paper.source
              )}
            </dd>
          </div>
        </dl>
      </article>

      {paper.sections.map((section) => (
        <section
          key={section.heading}
          className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4"
        >
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">
            {section.heading}
          </h2>
          <div className="mt-2 space-y-2">
            {section.body.map((paragraph, index) => (
              <p key={index} className="text-[11.5px] leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}

      {paper.backs.length > 0 ? (
        <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-border bg-card/50 p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-scan">
            Products this backs
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {paper.backs.map((slug) => (
              <li key={slug}>
                <Link
                  to="/store/$slug"
                  params={{ slug }}
                  className="rounded-sm border border-signal/40 px-2 py-1 text-[10px] uppercase tracking-widest text-signal hover:bg-signal/10"
                >
                  {slug.replace(/-/g, " ")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-warn/40 bg-card/50 p-4">
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Published summary of an attorney-review draft or engineering record — not a filing, not a
          patentability opinion, not a safety certification. Engine parameters, signing keys and
          customer records never appear in any published paper.
        </p>
      </section>
    </main>
  );
}
