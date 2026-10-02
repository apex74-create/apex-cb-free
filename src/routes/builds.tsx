import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PRODUCT_BUILDS } from "@/lib/product-builds";
import { awsBase, checkAwsHealth, setAwsBase, type AwsHealth } from "@/lib/aws-endpoint";

export const Route = createFileRoute("/builds")({
  head: () => ({
    meta: [
      { title: "Product builds — Apex Signal" },
      {
        name: "description",
        content:
          "The five Apex Signal product builds and their status on Google Play, the Apple App Store and desktop, plus the AWS data connection.",
      },
      { property: "og:title", content: "Apex Signal product builds" },
      {
        property: "og:description",
        content: "Sovereign CB, Field Grower, Sky Observer, Research and RadioLab: where each build ships.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuildsScreen,
});

const HEALTH_LABEL: Record<AwsHealth, string> = {
  unset: "not set",
  online: "linked",
  degraded: "reachable, not healthy",
  offline: "offline",
};

function BuildsScreen() {
  const [health, setHealth] = useState<AwsHealth>("unset");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => void checkAwsHealth().then(setHealth);
  useEffect(() => {
    setUrl(awsBase());
    refresh();
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-lg font-bold uppercase tracking-widest text-signal">Product builds</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        One radio core, five builds. Each has its own name, icon, listing and data path.
      </p>

      <section className="mt-5 rounded-sm border border-border p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-widest">AWS data connection</h2>
        <p className="mt-1 text-sm">
          Status: <span className={health === "online" ? "text-signal" : "text-warn"}>{HEALTH_LABEL[health]}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com"
            className="min-w-60 flex-1 rounded-sm border border-border bg-background px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              try {
                setAwsBase(url);
                setErr(null);
                refresh();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Invalid address");
              }
            }}
            className="rounded-sm border border-signal/60 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-signal"
          >
            Save + check
          </button>
        </div>
        {err ? <p className="mt-1 text-xs text-destructive">{err}</p> : null}
        <p className="mt-2 text-[10px] text-muted-foreground">
          Copilot hosts this service. No AWS keys are stored in the app.
        </p>
      </section>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[9px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="py-2">Build</th>
              <th>Google Play</th>
              <th>App Store</th>
              <th>Desktop</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCT_BUILDS.map((b) => (
              <tr key={b.id} className="border-t border-border align-top">
                <td className="py-2 pr-2">
                  <a href={b.startPath} className="font-bold text-signal hover:underline">
                    {b.name}
                  </a>
                  <p className="text-[11px] text-muted-foreground">{b.note}</p>
                  {b.gated ? (
                    <p className="text-[10px] uppercase tracking-widest text-warn">
                      Sign-in + safe-use policy
                    </p>
                  ) : null}
                </td>
                <td className="text-xs">Listing ready · upload pending</td>
                <td className="text-xs">Listing ready · Mac build pending</td>
                <td className="text-xs">{b.id === "cb" ? "Packaged (unsigned)" : "Script ready"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        iPhone builds need a Mac with Xcode and an Apple Developer account. Cable (USB) radios work
        on Android and desktop only; iPhone uses Bluetooth.
      </p>
      <Link to="/play-readiness" className="mt-3 inline-block text-xs text-scan hover:underline">
        Play readiness checklist
      </Link>
    </main>
  );
}
