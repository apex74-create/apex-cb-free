import { useCallback, useEffect, useRef, useState } from "react";
import { useBridge } from "@/lib/bridge-hooks";
import { ASSEMBLIES, type Assembly } from "@/lib/assembly";
import { checkCompat, type DeviceProfile } from "@/lib/compat";
import { isTermuxCommand, termuxRunCommandCmd, termuxTypeCmd } from "@/lib/termux";

/** Where assembly-install.sh drops the downloaded apks on the agent host. */
const APK_DIR = "$HOME/apex/assembly";

/** How Termux steps get delivered. */
type TermuxMode = "type" | "service";

type Step = {
  id: string;
  comp: string;
  label: string;
  /** command sent over the bridge, or null when the operator must run it in Termux */
  cmd: string | null;
  /** raw Termux line, kept for copy-to-clipboard */
  raw?: string;
};

type StepState = "wait" | "run" | "done" | "fail" | "skip";

/** Turn the manifest steps into things the bridge agent can actually run. */
function stepsFor(a: Assembly, mode: TermuxMode): Step[] {
  const out: Step[] = a.install
    ? [
        {
          id: `${a.key}:install`,
          comp: a.name,
          label: `install ${a.name}`,
          cmd: `install -r ${APK_DIR}/${a.key}.apk`,
        },
      ]
    : [];
  (a.post ?? []).forEach((p, i) => {
    const isAdb = p.startsWith("adb ");
    const bare = isAdb ? p.slice(4) : p;
    const termux = !isAdb && isTermuxCommand(bare);
    out.push({
      id: `${a.key}:post${i}`,
      comp: a.name,
      label: (termux ? "termux: " : "") + (p.length > 40 ? `${p.slice(0, 40)}…` : p),
      cmd: isAdb
        ? bare
        : termux
          ? mode === "type"
            ? termuxTypeCmd(bare)
            : termuxRunCommandCmd(bare)
          : null,
      ...(termux ? { raw: bare } : {}),
    });
  });
  return out;
}

export function InstallRunner({ device }: { device: DeviceProfile | null }) {
  const { state, run, autoLink, bootstrapAssembly } = useBridge();
  const [picked, setPicked] = useState<string[]>(ASSEMBLIES.map((a) => a.key));
  const [status, setStatus] = useState<Record<string, StepState>>({});
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [mode, setMode] = useState<TermuxMode>("type");
  const cancelRef = useRef(false);
  const logEnd = useRef<HTMLDivElement>(null);

  const push = useCallback((s: string) => {
    const t = new Date().toISOString().slice(11, 19);
    setLines((prev) => [...prev.slice(-400), `${t} ${s}`]);
  }, []);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  const toggle = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const start = async () => {
    if (running) return;
    cancelRef.current = false;
    setRunning(true);
    setStatus({});
    setLines([]);
    push(`bridge=${state} · device sdk=${device?.sdk ?? "?"} abi=${device?.abis[0] ?? "?"}`);

    try {
      if (state !== "online") {
        push("connecting bridge…");
        if (!(await autoLink())) throw new Error("bridge agent did not answer");
      }
      push("fetching signed upstream APKs and deploying the Reticulum helper…");
      const prepared = await bootstrapAssembly();
      for (const line of prepared.split("\n").slice(-30)) if (line.trim()) push(`  ${line.trim()}`);
    } catch (e) {
      push(`SETUP STOPPED — ${e instanceof Error ? e.message : "bootstrap failed"}`);
      setRunning(false);
      return;
    }

    const queue = ASSEMBLIES.filter((a) => picked.includes(a.key));
    let ok = 0;
    let failed = 0;

    for (const a of queue) {
      if (cancelRef.current) break;
      const compat = checkCompat(a, device);
      if (compat.verdict === "block") {
        push(`SKIP ${a.name} — ${compat.reasons.join("; ")}`);
        for (const s of stepsFor(a, mode)) setStatus((m) => ({ ...m, [s.id]: "skip" }));
        continue;
      }
      if (compat.verdict === "warn") push(`WARN ${a.name} — ${compat.reasons.join("; ")}`);

      for (const s of stepsFor(a, mode)) {
        if (cancelRef.current) break;
        if (!s.cmd) {
          setStatus((m) => ({ ...m, [s.id]: "skip" }));
          push(`MANUAL (run in Termux): ${s.raw ?? s.label}`);
          continue;
        }
        setCurrent(s.id);
        setStatus((m) => ({ ...m, [s.id]: "run" }));
        push(`> adb ${s.cmd}`);
        try {
          const out = await run(s.cmd, 90000);
          for (const l of out.split("\n").slice(0, 40)) if (l.trim()) push(`  ${l.trim()}`);
          const bad = /failure|error|not found|no such file/i.test(out);
          setStatus((m) => ({ ...m, [s.id]: bad ? "fail" : "done" }));
          if (bad) failed++;
          else ok++;
        } catch (e) {
          setStatus((m) => ({ ...m, [s.id]: "fail" }));
          failed++;
          push(`  !! ${e instanceof Error ? e.message : "step failed"}`);
        }
      }
    }

    setCurrent(null);
    setRunning(false);
    push(
      cancelRef.current
        ? `cancelled — ${ok} ok, ${failed} failed`
        : `finished — ${ok} ok, ${failed} failed`,
    );
  };

  const allSteps = ASSEMBLIES.filter((a) => picked.includes(a.key)).flatMap((a) =>
    stepsFor(a, mode),
  );
  const done = allSteps.filter((s) => ["done", "skip", "fail"].includes(status[s.id] ?? "")).length;
  const pct = allSteps.length ? Math.round((done / allSteps.length) * 100) : 0;

  return (
    <section className="border border-border rounded p-2 space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-[11px] font-bold tracking-widest text-primary">INSTALL RUNNER</h2>
        <span className="ml-auto text-[9px] opacity-70">{pct}%</span>
      </div>

      <div className="h-1.5 bg-muted rounded overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-wrap gap-1">
        {ASSEMBLIES.map((a) => {
          const c = checkCompat(a, device);
          const on = picked.includes(a.key);
          return (
            <button
              key={a.key}
              onClick={() => toggle(a.key)}
              disabled={running}
              className={
                "text-[9px] px-2 py-1 rounded border disabled:opacity-40 " +
                (c.verdict === "block"
                  ? "border-destructive text-destructive"
                  : on
                    ? "border-primary text-primary"
                    : "border-border opacity-60")
              }
              title={c.reasons.join("; ")}
            >
              {a.name}
              {c.verdict === "block" ? " ✕" : c.verdict === "warn" ? " !" : ""}
            </button>
          );
        })}
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => void start()}
          disabled={running || picked.length === 0}
          className="text-[10px] border border-primary text-primary px-2 py-1 rounded disabled:opacity-40"
        >
          {running ? "SETTING UP…" : "ONE BUTTON SETUP"}
        </button>
        <button
          onClick={() => {
            cancelRef.current = true;
            push("cancel requested — stopping after current step");
          }}
          disabled={!running}
          className="text-[10px] border border-destructive text-destructive px-2 py-1 rounded disabled:opacity-40"
        >
          CANCEL
        </button>
        <button
          onClick={() => setLines([])}
          disabled={running}
          className="ml-auto text-[10px] border border-border px-2 py-1 rounded disabled:opacity-40"
        >
          CLEAR LOG
        </button>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[9px] opacity-60">termux steps:</span>
        {(["type", "service"] as TermuxMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            disabled={running}
            className={
              "text-[9px] px-2 py-0.5 rounded border disabled:opacity-40 " +
              (mode === m ? "border-primary text-primary" : "border-border opacity-60")
            }
          >
            {m === "type" ? "TYPE INTO TERMUX" : "RUN_COMMAND API"}
          </button>
        ))}
        <button
          onClick={() => {
            const t = allSteps
              .filter((s) => s.raw)
              .map((s) => s.raw!)
              .join("\n");
            void navigator.clipboard?.writeText(t);
            push(`copied ${t.split("\n").filter(Boolean).length} termux lines to clipboard`);
          }}
          className="ml-auto text-[9px] border border-border px-2 py-0.5 rounded"
        >
          COPY PKG LINES
        </button>
      </div>

      <ul className="space-y-0.5">
        {allSteps.map((s) => {
          const st = status[s.id] ?? "wait";
          return (
            <li key={s.id} className="flex items-center gap-1.5 text-[9px]">
              <span
                className={
                  st === "done"
                    ? "text-primary"
                    : st === "fail"
                      ? "text-destructive"
                      : st === "run"
                        ? "text-accent-foreground animate-pulse"
                        : "opacity-40"
                }
              >
                {st === "done"
                  ? "●"
                  : st === "fail"
                    ? "✕"
                    : st === "run"
                      ? "◐"
                      : st === "skip"
                        ? "·"
                        : "○"}
              </span>
              <span className={current === s.id ? "text-primary" : "opacity-75"}>{s.label}</span>
            </li>
          );
        })}
      </ul>

      <div className="border border-border rounded bg-muted/30 max-h-40 overflow-y-auto p-1.5">
        {lines.length === 0 ? (
          <p className="text-[9px] opacity-50">
            log empty — run the install to stream agent output here
          </p>
        ) : (
          lines.map((l, i) => (
            <p
              key={i}
              className="text-[9px] leading-tight whitespace-pre-wrap break-all opacity-85"
            >
              {l}
            </p>
          ))
        )}
        <div ref={logEnd} />
      </div>

      <p className="text-[9px] opacity-60">
        One button connects the bridge, downloads upstream APKs, installs them, deploys the
        Reticulum helper, and runs the Termux setup. Android may still show its required VPN,
        storage, and package-install consent screens.
      </p>
    </section>
  );
}
