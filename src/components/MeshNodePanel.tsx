/**
 * One-button attach for the real Reticulum node on the paired phone.
 *
 * Sequence (all real commands over the ADB bridge, no simulation):
 *   1. rnsd -d                  start the Reticulum daemon in Termux
 *   2. netchat.py listen        spool inbound LXMF to /sdcard/apex/inbox.jsonl
 *   3. netchat.py announce      announce our destination on the mesh
 *   4. rnstatus -A / rnpath -t  read interfaces + paths back
 *   5. ps | grep rnsd           confirm the daemon is actually alive
 *
 * The parsed result is published through mesh-status so /netchat and /radar
 * can show live mesh state instead of a blanket "no bridge".
 */
import { useCallback, useEffect, useState } from "react";
import { useBridge } from "@/lib/bridge-hooks";
import { CMD, parseIdentity, parsePaths, parseStatus, readSpool } from "@/lib/reticulum";
import {
  getMeshStatus,
  meshLive,
  setMeshStatus,
  subscribeMesh,
  type MeshStatus,
} from "@/lib/mesh-status";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function MeshNodePanel() {
  const { state, run } = useBridge();
  const [mesh, setMesh] = useState<MeshStatus>(() => getMeshStatus());
  const [step, setStep] = useState<string | null>(null);
  const offline = state !== "online";

  useEffect(() => subscribeMesh(setMesh), []);

  /** Cheap liveness poll — does not restart anything. */
  const probe = useCallback(async () => {
    if (offline) return;
    try {
      const alive = await run(CMD.rnsdAlive).catch(() => "0");
      const up = Number(alive.trim().split(/\s+/)[0] ?? 0) > 0;
      setMeshStatus({ up, at: Date.now() });
    } catch {
      /* the bridge log already carries the failure */
    }
  }, [offline, run]);

  useEffect(() => {
    void probe();
    const t = setInterval(() => void probe(), 10000);
    return () => clearInterval(t);
  }, [probe]);

  const attach = useCallback(async () => {
    if (offline || step) return;
    try {
      setStep("starting rnsd");
      await run(CMD.startNode());
      await wait(2500);

      setStep("starting lxmf listener");
      await run(CMD.startListener());
      await wait(1200);

      setStep("announcing");
      await run(CMD.announce()).catch(() => "");
      await wait(800);

      setStep("reading mesh");
      await run(CMD.status());
      await run(CMD.paths());
      await run(CMD.identity());
      await wait(1500); // termux writes the spool asynchronously

      const [st, pt, id, alive, listen] = await Promise.all([
        run(readSpool("rnstatus")).catch(() => ""),
        run(readSpool("rnpath")).catch(() => ""),
        run(readSpool("ident")).catch(() => ""),
        run(CMD.rnsdAlive).catch(() => "0"),
        run(`shell tail -n 3 /sdcard/apex/listen.log 2>/dev/null || echo ''`).catch(() => ""),
      ]);

      const ifaces = parseStatus(st);
      const paths = parsePaths(pt);
      const up = Number(alive.trim().split(/\s+/)[0] ?? 0) > 0;

      setMeshStatus({
        up,
        ifaces: ifaces.length,
        paths: paths.length > 0,
        pathCount: paths.length,
        identity: parseIdentity(id),
        listening: /listen|lxmf|ready/i.test(listen),
        at: Date.now(),
        note: up
          ? ifaces.length > 0
            ? "mesh node live"
            : "rnsd up but no interfaces — check ~/.reticulum/config"
          : "rnsd did not start — install rns in Termux (see SETUP)",
      });
    } catch (e) {
      setMeshStatus({ note: e instanceof Error ? e.message : "attach failed", at: Date.now() });
    } finally {
      setStep(null);
    }
  }, [offline, run, step]);

  const live = meshLive(mesh);

  return (
    <section className="mb-2 rounded-sm border border-border bg-card/60 p-2">
      <div className="flex items-center justify-between text-[8px] uppercase tracking-widest">
        <span className="text-muted-foreground">reticulum node</span>
        <span className={live ? "text-signal" : mesh.up ? "text-warn" : "text-muted-foreground"}>
          {live ? "● mesh live" : mesh.up ? "○ rnsd up" : "○ no node"}
        </span>
      </div>

      <dl className="mt-1 grid grid-cols-3 gap-1 text-[8px] uppercase tracking-wider">
        <div>
          <dt className="text-muted-foreground">ifaces</dt>
          <dd className={mesh.ifaces > 0 ? "text-signal" : "text-muted-foreground"}>
            {mesh.ifaces}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">paths</dt>
          <dd className={mesh.pathCount > 0 ? "text-signal" : "text-muted-foreground"}>
            {mesh.pathCount}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">inbox</dt>
          <dd className={mesh.listening ? "text-signal" : "text-muted-foreground"}>
            {mesh.listening ? "spooling" : "idle"}
          </dd>
        </div>
      </dl>

      {mesh.identity ? (
        <p className="mt-1 truncate text-[8px] uppercase tracking-wider text-scan">
          lxmf {mesh.identity}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void attach()}
        disabled={offline || step !== null}
        className="mt-1.5 w-full rounded-sm border border-signal/60 py-1 text-[9px] uppercase tracking-widest text-signal disabled:opacity-40"
      >
        {offline
          ? "link a bridge agent first"
          : step
            ? `${step}…`
            : live
              ? "re-attach mesh node"
              : "attach mesh node"}
      </button>

      {mesh.note ? (
        <p
          className={`mt-1 text-[8px] leading-snug ${live ? "text-muted-foreground" : "text-warn"}`}
        >
          {mesh.note}
        </p>
      ) : null}
    </section>
  );
}
