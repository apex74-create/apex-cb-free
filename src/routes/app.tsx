import { createFileRoute, Link } from "@tanstack/react-router";
import { TOOLS, toneBorder, toneClass } from "@/lib/tools";
import { isFeatureSlug } from "@/lib/features";
import FaceToggle from "@/components/FaceToggle";
import FeatureReel from "@/components/FeatureReel";
import LandingFace from "@/components/LandingFace";
import { useOperatorAccess } from "@/lib/use-operator-access";

type LandingSearch = { feature?: string | undefined; view?: "reel" | "grid" | "face" | undefined };

export const Route = createFileRoute("/app")({
  validateSearch: (search: Record<string, unknown>): LandingSearch => ({
    feature: isFeatureSlug(search["feature"]) ? (search["feature"] as string) : undefined,
    view: search["view"] === "grid" ? "grid" : search["view"] === "reel" ? "reel" : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Apex Signal Watch — Wrist Signal Console" },
      {
        name: "description",
        content:
          "Watch-sized signal console: mesh, SSID, RF and PCAP maps plus a failover ADB bridge, demonstrated feature by feature.",
      },
      { property: "og:title", content: "Apex Signal Watch — Wrist Signal Console" },
      {
        property: "og:description",
        content:
          "Watch-sized signal console: mesh, SSID, RF and PCAP maps plus a failover ADB bridge, demonstrated feature by feature.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const operator = useOperatorAccess();
  const { feature, view = "face" } = Route.useSearch();
  const navigate = Route.useNavigate();

  // A deep link like /?feature=hardware lands straight on that walkthrough
  // card, and every card change is written back to the URL so it stays
  // shareable.
  const select = (slug: string) =>
    void navigate({ search: (prev: LandingSearch) => ({ ...prev, feature: slug }), replace: true });

  const setView = (next: "reel" | "grid" | "face") =>
    void navigate({
      search: (prev: LandingSearch) => ({ ...prev, view: next === "face" ? undefined : next }),
      replace: true,
    });

  // Face preference: if the user last picked the multicolor weather face,
  // the watch lands there instead of the Apex face.
  if (view === "face") {
    try {
      if (window.localStorage.getItem("apex.face") === "weather") {
        window.location.replace("/watch.html");
        return null;
      }
    } catch {
      /* storage blocked — stay on the Apex face */
    }
    return <LandingFace onEnter={setView} />;
  }

  return (
    <main className="no-scrollbar relative min-h-app overflow-y-auto scan-grid face-pad pb-6 pt-2">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pb-2">
        <div className="min-w-0">
          <h1 className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-signal">
            Apex Signal
          </h1>
          <p className="truncate text-[8px] uppercase tracking-widest text-muted-foreground">
            {view === "reel" ? "Feature walkthrough" : "Sniffing gallery"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setView("face")}
            aria-label="Back to watch face"
            className="rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-signal active:bg-accent"
          >
            ◉
          </button>
          <button
            type="button"
            onClick={() => setView(view === "reel" ? "grid" : "reel")}
            className="rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:bg-accent"
          >
            {view === "reel" ? "grid" : "tour"}
          </button>

          <FaceToggle />
          <Link
            to="/settings"
            aria-label="Watch settings"
            className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
          >
            ⚙
          </Link>
        </div>
      </header>

      {view === "reel" ? (
        <FeatureReel slug={feature} onSelect={select} />
      ) : (
        <>
           {operator && <Link
            to="/bridge"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-scan/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-scan">⇋</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-scan">
                ADB Bridge
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                watch → phone · pc / phone / relay
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
           </Link>}

          <div className="mb-1.5 grid grid-cols-3 gap-1.5">
            <Link
              to="/forecast"
              className="rounded-sm border border-signal/60 bg-card/70 px-2 py-1.5 text-center text-[8px] uppercase tracking-widest text-signal active:bg-accent"
            >
              forecast
            </Link>
            <Link
              to="/map"
              className="rounded-sm border border-scan/60 bg-card/70 px-2 py-1.5 text-center text-[8px] uppercase tracking-widest text-scan active:bg-accent"
            >
              map
            </Link>
            <Link
              to="/feed"
              className="rounded-sm border border-warn/60 bg-card/70 px-2 py-1.5 text-center text-[8px] uppercase tracking-widest text-warn active:bg-accent"
            >
              lovely
            </Link>
          </div>

          <Link
            to="/netchat"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-warn/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-warn">☰</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-warn">
                Netchat · RNS
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                reticulum mesh · chat coin
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
          </Link>

          <Link
            to="/cb"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-alert/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-alert">▣</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-alert">
                Sovereign CB
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                standalone radio deck · rooms · day face
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
          </Link>

           {operator && <Link
            to="/pcap"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-signal/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-signal">⌁</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-signal">
                PCAPdroid
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                real packet capture · intent api
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
           </Link>}

           {operator && <Link
            to="/admin"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-alert/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-alert">⚑</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-alert">
                Admin Test Build
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                sas preflight · repo assemblies
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
           </Link>}

          <Link
            to="/face"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-signal/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-signal">◉</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-signal">
                Apex Face
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                live gauge · compass · sensors
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
          </Link>

          <Link
            to="/perms"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-scan/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-scan">⌗</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-scan">
                Permission Grid
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                web bus · hid companions · trilateration
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
          </Link>

          <Link
            to="/hardware"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-scan/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-scan">❖</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-scan">
                Hardware
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                bluetooth · radios · board
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
          </Link>

          <Link
            to="/diag"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-scan/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-scan">◈</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-scan">
                Diagnostics
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                scan perms · activity · map render
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
          </Link>

          <Link
            to="/watch-report"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-scan/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-scan">◉</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-scan">
                Black screen report
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                recording · panel read · verdict
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
          </Link>


          <Link
            to="/bio"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-alert/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-alert">♥</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-alert">
                Biometrics
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                hr · bp · spo2 · temp harvest
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
          </Link>

          <Link
            to="/search"
            className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-warn/50 bg-card/70 px-2 py-1.5 active:bg-accent"
          >
            <span className="shrink-0 text-sm leading-none text-warn">⌕</span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-warn">
                Sovereign Search
              </span>
              <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                clean exit · no pii · no headers
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">›</span>
          </Link>

          <ul className="grid grid-cols-[repeat(var(--face-cols,2),minmax(0,1fr))] gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {TOOLS.map((tool) => (
              <li key={tool.key}>
                <Link
                  to="/tool/$key"
                  params={{ key: tool.key }}
                  className={`face-tile rounded-sm border ${toneBorder[tool.tone]} bg-card/70 transition-colors active:bg-accent`}
                >
                  <span className={`text-lg leading-none ${toneClass[tool.tone]}`}>
                    {tool.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[10px] font-bold uppercase tracking-widest ${toneClass[tool.tone]}`}
                    >
                      {tool.short}
                    </span>
                    <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                      {tool.kind === "map" ? "map" : "panel"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
