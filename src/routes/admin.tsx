import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useBridge } from "@/lib/bridge-hooks";
import TierPanel from "@/components/TierPanel";
import CloudPanel from "@/components/CloudPanel";
import OperatorGate from "@/components/OperatorGate";
import {
  blankSteps,
  reportText,
  runPreflight,
  summarize,
  useBuildConfig,
  type Step,
} from "@/lib/build-profile";
import { copyReport, downloadReport, shareReport } from "@/lib/session-export";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Test Build — Apex Signal Watch" },
      {
        name: "description",
        content:
          "Flip the watch into the SAS test build, point it at the GitHub assemblies and run an end-to-end preflight before publishing.",
      },
      { property: "og:title", content: "Admin Test Build — Apex Signal Watch" },
      {
        property: "og:description",
        content:
          "Switch build profiles and validate SAS reachability, auth and ingest end to end from the watch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <OperatorGate><Admin /></OperatorGate>,
});

const TONE: Record<Step["state"], string> = {
  pending: "text-muted-foreground",
  running: "text-scan",
  pass: "text-signal",
  warn: "text-warn",
  fail: "text-alert",
};

const MARK: Record<Step["state"], string> = {
  pending: "·",
  running: "…",
  pass: "✓",
  warn: "!",
  fail: "✕",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block pb-1.5">
      <span className="block pb-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-border bg-input px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-scan"
      />
    </label>
  );
}

function Admin() {
  const { config, update } = useBuildConfig();
  const { state } = useBridge();
  const [steps, setSteps] = useState<Step[]>(blankSteps);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"run" | "conf">("run");
  const [note, setNote] = useState("");

  const testing = config.profile === "test";
  const sum = summarize(steps);

  const start = useCallback(async () => {
    setRunning(true);
    setNote("");
    // The test build is the point of the button: flip the profile first so the
    // run exercises the same gates the tester will be using afterwards.
    if (config.profile !== "test") update("profile", "test");
    try {
      const final = await runPreflight(
        { config: { ...config, profile: "test" }, bridgeState: state },
        setSteps,
      );
      const s = summarize(final);
      setNote(
        s.ready ? "all legs verified — ok to publish" : `${s.fail} failed · ${s.warn} unverified`,
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "preflight crashed");
    } finally {
      setRunning(false);
    }
  }, [config, state, update]);

  const exportRun = async (kind: "file" | "share" | "copy") => {
    const text = reportText(config, steps);
    try {
      if (kind === "file") {
        downloadReport(text);
        setNote("saved .txt");
      } else if (kind === "share") {
        setNote(await shareReport(text));
      } else {
        setNote(await copyReport(text));
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "export failed");
    }
  };

  return (
    <main className="flex h-app flex-col overflow-hidden scan-grid">
      <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border face-pad py-1">
        <Link
          to="/app"
          aria-label="Back to gallery"
          className="text-[10px] leading-none text-muted-foreground active:text-signal"
        >
          ‹
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[10px] font-bold uppercase tracking-widest text-alert">
            Admin · Test Build
          </h1>
          <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
            {testing ? "test profile active" : "release profile"} ·{" "}
            {config.staging ? "staging" : "live"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {(["run", "conf"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-sm border px-1.5 py-0.5 text-[8px] uppercase tracking-widest ${
                tab === t ? "border-scan text-scan" : "border-border text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto face-pad py-1.5">
        {tab === "run" ? (
          <>
            <button
              type="button"
              onClick={() => void start()}
              disabled={running}
              className={`w-full rounded-sm border py-2 text-[10px] font-bold uppercase tracking-widest ${
                running
                  ? "border-border text-muted-foreground"
                  : "border-alert text-alert active:bg-accent"
              }`}
            >
              {running ? "running preflight…" : "run admin test build"}
            </button>

            <div className="mt-1 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => update("profile", testing ? "release" : "test")}
                className={`rounded-sm border py-1 text-[8px] uppercase tracking-widest ${
                  testing ? "border-warn text-warn" : "border-border text-muted-foreground"
                }`}
              >
                {testing ? "back to release" : "enable test build"}
              </button>
              <button
                type="button"
                onClick={() => update("staging", !config.staging)}
                className={`rounded-sm border py-1 text-[8px] uppercase tracking-widest ${
                  config.staging ? "border-scan text-scan" : "border-alert text-alert"
                }`}
              >
                {config.staging ? "staging data" : "live data"}
              </button>
            </div>

            <ul className="mt-1.5">
              {steps.map((s) => (
                <li key={s.id} className="border-b border-border/60 py-1">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5">
                    <span className={`text-[10px] leading-none ${TONE[s.state]}`}>
                      {MARK[s.state]}
                    </span>
                    <span
                      className={`truncate text-[9px] uppercase tracking-widest ${TONE[s.state]}`}
                    >
                      {s.label}
                    </span>
                    <span className="shrink-0 text-[8px] text-muted-foreground">
                      {s.ms ? `${s.ms}ms` : ""}
                    </span>
                  </div>
                  {s.detail ? (
                    <p className="break-words pl-4 text-[8px] leading-tight text-muted-foreground">
                      {s.detail}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>

            <p className="pt-1 text-[8px] uppercase tracking-widest text-muted-foreground">
              {note || `${sum.pass} pass · ${sum.warn} warn · ${sum.fail} fail`}
            </p>

            <div className="mt-1 grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => void exportRun("file")}
                className="rounded-sm border border-signal py-1 text-[8px] uppercase tracking-widest text-signal active:bg-accent"
              >
                file
              </button>
              <button
                type="button"
                onClick={() => void exportRun("share")}
                className="rounded-sm border border-scan py-1 text-[8px] uppercase tracking-widest text-scan active:bg-accent"
              >
                share
              </button>
              <button
                type="button"
                onClick={() => void exportRun("copy")}
                className="rounded-sm border border-border py-1 text-[8px] uppercase tracking-widest text-muted-foreground active:bg-accent"
              >
                copy
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="pb-1 text-[8px] uppercase tracking-widest text-muted-foreground">
              Source assemblies
            </p>
            <Field label="github owner" value={config.owner} onChange={(v) => update("owner", v)} />
            <Field label="repo" value={config.repo} onChange={(v) => update("repo", v)} />
            <Field
              label="ref (branch / tag / sha)"
              value={config.ref}
              onChange={(v) => update("ref", v)}
            />

            <p className="pb-1 pt-1 text-[8px] uppercase tracking-widest text-muted-foreground">
              SAS backend
            </p>
            <Field
              label="base url"
              value={config.sasUrl}
              onChange={(v) => update("sasUrl", v)}
              placeholder="https://sas.example.com"
            />
            <Field label="tenant" value={config.tenant} onChange={(v) => update("tenant", v)} />
            <Field
              label="api key (stays on watch)"
              type="password"
              value={config.sasKey}
              onChange={(v) => update("sasKey", v)}
            />
            <p className="break-words pt-1 text-[8px] uppercase tracking-wider text-muted-foreground">
              Preflight hits {config.staging ? "/staging" : ""}/health, /v1/me and posts one probe
              record to /v1/ingest. The key is stored on this watch only and is redacted from
              exports.
            </p>
          </>
        )}

        <CloudPanel />
        <TierPanel />
      </div>
    </main>
  );
}
