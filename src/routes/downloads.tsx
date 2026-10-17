import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import InstallApp from "@/components/InstallApp";
import FreeInstallCount from "@/components/FreeInstallCount";
import { Button } from "@/components/ui/button";
import {
  loadBuildsManifest,
  type BuildsManifest,
  type ReleaseArtifact,
  type ReleaseChannel,
} from "@/lib/builds";
import { DOWNLOAD_BRANCHES, BRANCH_EXCLUSIONS } from "@/lib/download-branch";
import { getDownloadGrants } from "@/utils/downloads.functions";
import { useSession } from "@/lib/cloud";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads — Apex Signal" },
      {
        name: "description",
        content:
          "Choose the live PWA, Google Play rollout, or signed Android APK downloads for Apex Signal.",
      },
      { property: "og:title", content: "Downloads — Apex Signal" },
      { property: "og:description", content: "Find available Apex Signal app downloads and release channels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DownloadsScreen,
});

function artifactActionLabel(artifact: ReleaseArtifact): string {
  if (!artifact.available) return "coming soon";
  if (!artifact.url) return "link pending";
  return artifact.kind === "aab" ? "open bundle" : "download apk";
}

function channelActionLabel(channel: ReleaseChannel): string {
  if (!channel.available) return "coming soon";
  if (!channel.url) return "link pending";
  return channel.kind === "pwa" ? "open live app" : "open channel";
}

function DownloadsScreen() {
  const [manifest, setManifest] = useState<BuildsManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const next = await loadBuildsManifest();
        if (active) setManifest(next);
      } catch (loadError) {
        if (active) {
          setManifest(null);
          setError(
            loadError instanceof Error ? loadError.message : "Release manifest failed to load",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const latest = useMemo(
    () =>
      manifest?.builds.find((build) => build.version === manifest.latest) ??
      manifest?.builds[0] ??
      null,
    [manifest],
  );

  // The branch list is public; the grant is resolved server-side against the
  // account's licences, so nothing here can be unlocked from the browser.
  const { session } = useSession();
  const fetchGrants = useServerFn(getDownloadGrants);
  const grants = useQuery({
    queryKey: ["download-grants", session?.user.id ?? "anon"],
    queryFn: () => fetchGrants(),
    enabled: Boolean(session),
  });
  const grantByBranch = new Map((grants.data?.grants ?? []).map((g) => [g.branchId, g]));


  return (
    <main className="no-scrollbar min-h-app overflow-y-auto scan-grid face-pad pb-8 pt-2">
      <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-signal">
            Apex Signal Downloads
          </h1>
          <p className="truncate text-[8px] uppercase tracking-widest text-muted-foreground">
            Live install · Play rollout · signed APK
          </p>
        </div>
        <Link
          to="/"
          className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
        >
          ◉
        </Link>
      </header>

      <section className="mb-4 rounded-sm border border-signal/40 bg-signal/5 p-3">
        <p className="text-[8px] uppercase tracking-widest text-signal">release center</p>
        <p className="mt-1 text-[8px] leading-relaxed text-muted-foreground">
          The live Lovable PWA is the source of truth. Google Play uses the TWA wrapper, and direct
          Android installs use signed APK artifacts when they are uploaded.
        </p>
        {manifest ? (
          <div className="mt-2 grid gap-1 text-[7.5px] text-muted-foreground">
            <span>live: {manifest.app.liveUrl}</span>
            <span>support: {manifest.app.supportUrl}</span>
            <span>privacy: {manifest.app.privacyUrl}</span>
          </div>
        ) : null}
      </section>

      {loading ? (
        <section className="mb-4 rounded-sm border border-border bg-card/50 p-3">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground">
            loading release data…
          </p>
        </section>
      ) : error ? (
        <section className="mb-4 rounded-sm border border-alert/50 bg-alert/5 p-3">
          <p className="text-[8px] uppercase tracking-widest text-alert">manifest error</p>
          <p className="mt-1 text-[8px] text-muted-foreground">{error}</p>
        </section>
      ) : null}

      <section className="mb-4 rounded-sm border border-signal/60 bg-signal/5 p-3">
        <h2 className="mb-1 text-[9px] uppercase tracking-[0.25em] text-signal">
          Recommended · Install the app
        </h2>
        <p className="mb-2 text-[7.5px] leading-relaxed text-muted-foreground">
          The installable app is the shipping build. One tap adds it to your home screen with its
          own icon, full screen, and every tool included.
        </p>
        <InstallApp />
        <div className="mt-2"><FreeInstallCount /></div>
        <Link
          to="/app"
          className="mt-2 inline-block text-[7.5px] uppercase tracking-widest text-scan underline-offset-2 hover:underline"
        >
          Or open the tool deck in this browser
        </Link>
      </section>

      <section className="mb-4">
        <h2 className="mb-1 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
          Download branches
        </h2>
        <p className="mb-2 text-[7.5px] leading-relaxed text-muted-foreground">
          A licence opens a branch, not a single file. The branch stays current, so anything that
          ships later appears on the same branch at no extra cost.{" "}
          {session
            ? grants.isLoading
              ? "Checking what your account holds…"
              : `${grantByBranch.size} of ${DOWNLOAD_BRANCHES.length} open on this account.`
            : "Sign in to see which branches your licences open."}
        </p>
        {!session ? (
          <div className="mb-2 flex flex-wrap gap-2">
            <Link
              to="/auth"
              className="rounded-sm border border-signal/50 px-2 py-1 text-[8px] uppercase tracking-widest text-signal"
            >
              sign in
            </Link>
            <Link
              to="/pricing"
              className="rounded-sm border border-border px-2 py-1 text-[8px] uppercase tracking-widest text-muted-foreground"
            >
              see prices
            </Link>
          </div>
        ) : null}

        <div className="grid gap-2">
          {DOWNLOAD_BRANCHES.map((branch) => {
            const grant = grantByBranch.get(branch.id);
            return (
              <div
                key={branch.id}
                className={`rounded-sm border p-2.5 ${
                  grant ? "border-signal/50 bg-signal/5" : "border-border bg-card/50"
                }`}
              >
                <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[9px] font-semibold text-signal">{branch.name}</h3>
                    <p className="text-[7.5px] text-muted-foreground">{branch.summary}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[7px] uppercase tracking-widest ${
                      grant ? "border-signal/60 text-signal" : "border-border text-muted-foreground"
                    }`}
                  >
                    {grant ? "open" : "locked"}
                  </span>
                </div>
                <ul className="mb-1.5 grid gap-0.5 text-[7px] text-muted-foreground">
                  {branch.contents.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
                {grant ? (
                  <p className="break-all text-[7px] uppercase tracking-widest text-scan">
                    branch {grant.ref} · key {grant.licenceKey}
                  </p>
                ) : (
                  <p className="text-[7px] uppercase tracking-widest text-muted-foreground">
                    opened by {branch.unlockedBy.slice(0, 3).join(", ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <ul className="mt-2 grid gap-0.5 text-[7px] text-muted-foreground">
          {BRANCH_EXCLUSIONS.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      </section>



      {latest ? (
        <section className="mb-4 rounded-sm border border-warn/50 bg-card/60 p-3">
          <p className="text-[8px] uppercase tracking-widest text-warn">latest release</p>
          <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-[10px] font-bold uppercase tracking-widest text-signal">
                {latest.name}
              </h2>
              <p className="mt-1 text-[8px] text-muted-foreground">{latest.description}</p>
            </div>
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-[7px] uppercase tracking-widest text-muted-foreground">
              {latest.version}
            </span>
          </div>
          <p className="mt-2 text-[7.5px] leading-relaxed text-muted-foreground">
            {latest.releaseNotes}
          </p>
        </section>
      ) : null}

      {manifest ? (
        <section className="mb-4">
          <h2 className="mb-2 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
            Install channels
          </h2>
          <div className="grid gap-2">
            {manifest.channels.map((channel) => (
              <div
                key={channel.key}
                className="rounded-sm border border-border bg-card/50 p-2.5 transition-colors hover:bg-card"
              >
                <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[9px] font-semibold text-signal">
                      {channel.title}
                    </h3>
                    <p className="text-[7.5px] text-muted-foreground">{channel.description}</p>
                  </div>
                  <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[7px] uppercase tracking-widest text-muted-foreground">
                    {channel.kind}
                  </span>
                </div>
                <div className="grid gap-1 text-[7px] text-muted-foreground">
                  <span>status: {channel.available ? "ready" : "not published yet"}</span>
                  <span>{channel.note}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!channel.available || !channel.url}
                  className="mt-2 w-full border-signal/60 bg-signal/10 text-[8px] uppercase tracking-widest text-signal disabled:border-border disabled:bg-transparent disabled:text-muted-foreground"
                  onClick={() => {
                    if (channel.available && channel.url) {
                      window.location.href = channel.url;
                    }
                  }}
                >
                  {channelActionLabel(channel)}
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {manifest ? (
        <section>
          <h2 className="mb-2 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
            Signed builds
          </h2>
          <div className="grid gap-2">
            {manifest.builds.map((build) => {
              const artifact = build.directDownload;
              return (
                <div
                  key={build.version}
                  className="rounded-sm border border-border bg-card/50 p-2.5 transition-colors hover:bg-card"
                >
                  <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[9px] font-semibold text-signal">
                        {build.name}
                      </h3>
                      <p className="text-[7.5px] text-muted-foreground">{build.description}</p>
                    </div>
                    <span className="shrink-0 rounded-sm bg-accent px-1.5 py-0.5 text-[7px] font-bold text-foreground">
                      ${artifact.priceUsd.toFixed(2)}
                    </span>
                  </div>

                  <div className="mb-1.5 grid grid-cols-2 gap-1 text-[7px] text-muted-foreground">
                    <span>released: {build.releasedAt}</span>
                    <span>size: {artifact.sizeLabel}</span>
                    <span>package: {artifact.kind.toUpperCase()}</span>
                    <span>status: {artifact.available ? "ready" : "not uploaded yet"}</span>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1">
                    {build.features.map((feature) => (
                      <span
                        key={feature}
                        className="rounded-xs border border-border px-1 py-0.5 text-[6.5px] text-scan"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  <p className="mb-2 text-[7.5px] leading-relaxed text-muted-foreground">
                    {artifact.note}
                  </p>
                  <p className="mb-2 break-all text-[6.5px] uppercase tracking-widest text-muted-foreground">
                    sha256: {artifact.sha256 ?? "pending real artifact upload"}
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={!artifact.available || !artifact.url}
                    className="w-full border-signal/60 bg-signal/10 text-[8px] uppercase tracking-widest text-signal disabled:border-border disabled:bg-transparent disabled:text-muted-foreground"
                    onClick={() => {
                      if (artifact.available && artifact.url) {
                        window.location.href = artifact.url;
                      }
                    }}
                  >
                    {artifactActionLabel(artifact)}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-sm border border-muted-foreground/20 bg-muted/5 p-3">
        <h3 className="mb-1.5 text-[8px] font-semibold uppercase tracking-widest text-muted-foreground">
          Sales-ready notes
        </h3>
        <p className="text-[7.5px] leading-relaxed text-muted-foreground">
          Store rollout uses the same hosted PWA, while direct Android downloads appear here only
          after a signed artifact is uploaded and hashed into the release manifest.
        </p>
      </section>
    </main>
  );
}
