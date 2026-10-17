import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { getTool, TOOLS, toneClass, type Tool } from "@/lib/tools";
import ToolPanel from "@/components/ToolPanel";
import ApexFace from "@/components/ApexFace";

const SignalMap = lazy(() => import("@/components/SignalMap"));

export const Route = createFileRoute("/tool/$key")({
  loader: ({ params }) => {
    const tool = getTool(params.key);
    if (!tool) throw notFound();
    return { tool };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Unavailable — Apex Signal" },
          { name: "description", content: "This Apex Signal tool is unavailable." },
          { property: "og:title", content: "Unavailable — Apex Signal" },
          { property: "og:description", content: "This Apex Signal tool is unavailable." },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { tool } = loaderData;
    const title = `${tool.name} — Apex Signal Watch`;
    return {
      meta: [
        { title },
        { name: "description", content: `${tool.name}: ${tool.sub}. Full-screen watch view.` },
        { property: "og:title", content: title },
        { property: "og:description", content: `${tool.name}: ${tool.sub}.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ToolView,
});

function ToolView() {
  const { tool } = Route.useLoaderData() as { tool: Tool };
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const index = TOOLS.findIndex((t) => t.key === tool.key);
  const next = TOOLS[(index + 1) % TOOLS.length]!;

  // Maps run full-bleed: the map owns the whole viewport (watch face or full
  // phone PWA window) and the chrome floats over it instead of shrinking it.
  const isMap = tool.kind === "map";

  return (
    <main className="relative flex h-app w-full flex-col overflow-hidden bg-background">
      {isMap ? (
        <div className="absolute inset-0 z-0">
          {mounted ? (
            <Suspense fallback={<Loading />}>
              <SignalMap tool={tool} />
            </Suspense>
          ) : (
            <Loading />
          )}
        </div>
      ) : null}

      <header
        className={`z-10 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border face-pad py-1.5 ${
          isMap ? "pointer-events-none bg-background/60 backdrop-blur-sm" : "bg-background/90"
        }`}
      >
        <Link
          to="/app"
          aria-label="Back to gallery"
          className="pointer-events-auto shrink-0 px-1 text-[12px] leading-none text-muted-foreground active:text-signal"
        >
          ‹
        </Link>
        <h1
          className={`min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.2em] ${toneClass[tool.tone]}`}
        >
          {tool.short}
        </h1>
        <Link
          to="/tool/$key"
          params={{ key: next.key }}
          aria-label={`Next tool: ${next.name}`}
          className="pointer-events-auto shrink-0 px-1 text-[12px] leading-none text-muted-foreground active:text-signal"
        >
          ›
        </Link>
      </header>

      <section className={`relative min-h-0 flex-1 ${isMap ? "pointer-events-none" : ""}`}>
        {isMap ? null : (
          <>
            {/* Apex substrate: pulsing gauge, octahedron and dorito behind the feed. */}
            <div className="pointer-events-none absolute inset-0">
              <ApexFace ambient signal={{ strength: 0.6, heading: null }} />
            </div>
            <div className="relative h-full">
              <ToolPanel tool={tool} />
            </div>
          </>
        )}
      </section>

      <footer
        className={`z-10 shrink-0 border-t border-border face-pad py-1 ${
          isMap ? "pointer-events-none bg-background/60 backdrop-blur-sm" : "bg-background/90"
        }`}
      >
        <p className="truncate text-[8px] uppercase tracking-widest text-muted-foreground">
          {tool.sub}
        </p>
      </footer>
    </main>
  );
}

function Loading() {
  return (
    <div className="absolute inset-0 grid place-items-center scan-grid">
      <span className="pulse-dot text-[9px] uppercase tracking-widest text-signal">acquiring…</span>
    </div>
  );
}
