import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useBridge } from "@/lib/bridge-hooks";
import {
  ASSEMBLIES,
  FIELD_SCRIPTS,
  COMPLIANCE,
  fullInstallScript,
  parseInstalled,
  pkgListCmd,
} from "@/lib/assembly";
import {
  checkCompat,
  compatCmd,
  compatFeaturesCmd,
  parseCompat,
  type DeviceProfile,
} from "@/lib/compat";
import { InstallRunner } from "@/components/InstallRunner";

export const Route = createFileRoute("/assembly")({
  head: () => ({
    meta: [
      { title: "Full Assembly — PCAPdroid + Termux — Apex Signal" },
      {
        name: "description",
        content:
          "The shipping bundle: PCAPdroid capture, PCAPdroid-mitm, Termux, Termux:API and Termux:Boot — repos, licences, install commands and live installed-state over the ADB bridge.",
      },
      { property: "og:title", content: "Full Assembly — PCAPdroid + Termux" },
      {
        property: "og:description",
        content:
          "Every upstream component in the Apex Signal sale bundle, with git repo, licence and one-tap install commands.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssemblyView,
});

function AssemblyView() {
  const { state, run } = useBridge();
  const [installed, setInstalled] = useState<Set<string> | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<DeviceProfile | null>(null);

  const refresh = useCallback(async () => {
    if (state !== "online") return;
    setBusy(true);
    try {
      setInstalled(parseInstalled(await run(pkgListCmd)));
      const [compatRaw, featRaw] = await Promise.all([run(compatCmd), run(compatFeaturesCmd)]);
      setDevice(parseCompat(compatRaw, featRaw));
      setNote("");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "package sweep failed");
    } finally {
      setBusy(false);
    }
  }, [run, state]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote(`copied ${label}`);
    } catch {
      setNote("clipboard blocked — select and copy manually");
    }
  };

  return (
    <div className="min-h-app overflow-y-auto bg-background text-foreground p-3 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold tracking-widest text-primary">FULL ASSEMBLY</h1>
          <p className="text-[10px] opacity-70">pcapdroid + termux · sale bundle manifest</p>
        </div>
        <Link to="/app" className="text-[10px] border border-border px-2 py-1 rounded">
          ← HOME
        </Link>
      </header>

      <div className="flex items-center gap-2 text-[10px]">
        <span className="opacity-70">bridge:</span>
        <span className={state === "online" ? "text-primary" : "text-destructive"}>{state}</span>
        <button
          onClick={() => void refresh()}
          disabled={state !== "online" || busy}
          className="ml-auto border border-border px-2 py-1 rounded disabled:opacity-40"
        >
          {busy ? "SWEEPING…" : "RE-SWEEP"}
        </button>
        <button
          onClick={() => void copy(fullInstallScript(), "installer script")}
          className="border border-border px-2 py-1 rounded"
        >
          COPY INSTALLER
        </button>
      </div>
      {note ? <p className="text-[10px] text-accent-foreground opacity-80">{note}</p> : null}

      <ul className="space-y-3">
        {ASSEMBLIES.map((a) => {
          const present = a.pkg && installed ? installed.has(a.pkg) : null;
          const compat = checkCompat(a, device);
          return (
            <li key={a.key} className="border border-border rounded p-2 space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold tracking-wide">{a.name}</span>
                <span
                  className={
                    "text-[9px] px-1 rounded border " +
                    (present === null
                      ? "opacity-50 border-border"
                      : present
                        ? "text-primary border-primary"
                        : "text-destructive border-destructive")
                  }
                >
                  {present === null ? "UNKNOWN" : present ? "INSTALLED" : "MISSING"}
                </span>
                <span
                  className={
                    "text-[9px] px-1 rounded border " +
                    (compat.verdict === "block"
                      ? "text-destructive border-destructive"
                      : compat.verdict === "warn"
                        ? "text-accent-foreground border-border"
                        : compat.verdict === "ok"
                          ? "text-primary border-primary"
                          : "opacity-50 border-border")
                  }
                >
                  {compat.verdict === "block"
                    ? "INCOMPATIBLE"
                    : compat.verdict === "warn"
                      ? "CHECK"
                      : compat.verdict === "ok"
                        ? "COMPATIBLE"
                        : "UNCHECKED"}
                </span>
                <span className="ml-auto text-[9px] opacity-70">{a.license}</span>
              </div>
              <p className="text-[9px] opacity-70">
                {compat.reasons.join(" · ")}
                {a.minSdk ? ` · needs sdk ${a.minSdk}+` : ""}
              </p>
              <p className="text-[10px] opacity-80">{a.role}</p>
              <p className="text-[10px] opacity-60">{a.notes}</p>
              <div className="flex flex-wrap gap-1 text-[9px]">
                <a
                  href={a.repo}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-border px-2 py-1 rounded"
                >
                  GIT
                </a>
                <a
                  href={a.releases}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-border px-2 py-1 rounded"
                >
                  RELEASE
                </a>
                {a.fdroid ? (
                  <a
                    href={a.fdroid}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-border px-2 py-1 rounded"
                  >
                    F-DROID
                  </a>
                ) : null}
                <button
                  onClick={() =>
                    void copy(
                      [...(a.install ? [a.install] : []), ...(a.post ?? [])].join("\n"),
                      `${a.name} steps`,
                    )
                  }
                  className="border border-border px-2 py-1 rounded"
                >
                  COPY STEPS
                </button>
              </div>
              <pre className="text-[9px] leading-tight opacity-75 whitespace-pre-wrap break-all border-l border-border pl-2">
                {[...(a.install ? [a.install] : []), ...(a.post ?? [])].join("\n")}
              </pre>
            </li>
          );
        })}
      </ul>

      <InstallRunner device={device} />

      <section className="border border-border rounded p-2 space-y-2">
        <h2 className="text-[11px] font-bold tracking-widest text-primary">
          FIELD SCRIPTS — PROPRIETARY · LICENSED
        </h2>
        <p className="text-[10px] opacity-70">
          These are the inventor's proprietary operational scripts. They are not public downloads.
          Use them two ways: call the protected defense API from a paid tier, or buy the script
          itself under an operator licence (network operators, console buyers). Licensed copies
          stay confidential — no redistribution, resale, publication or reverse engineering.
        </p>
        {FIELD_SCRIPTS.map((s) => (
          <div key={s.key} className="border border-border rounded p-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold">{s.name}</p>
              <span className="text-[9px] border border-border rounded px-1 text-primary">
                LICENCE REQUIRED
              </span>
            </div>
            <p className="text-[10px] opacity-80">{s.role}</p>
            <p className="text-[10px] text-signal">USED BY · {s.usedBy}</p>
            <div className="flex flex-wrap gap-1 text-[9px]">
              <Link to="/store" className="border border-border px-2 py-1 rounded">
                API ACCESS / BUY LICENCE
              </Link>
            </div>
          </div>
        ))}
      </section>



      <section className="border border-border rounded p-2 space-y-1">
        <h2 className="text-[11px] font-bold tracking-widest text-primary">RESALE COMPLIANCE</h2>
        <ul className="space-y-1">
          {COMPLIANCE.map((c) => (
            <li key={c} className="text-[10px] opacity-80">
              · {c}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
