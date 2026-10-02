import { useCallback, useEffect, useState } from "react";
import { useBridge } from "@/lib/bridge-hooks";
import {
  HIDDEN_ROOTS,
  crumbs,
  listCmd,
  parentPath,
  parseListing,
  probeState,
  statCmd,
  type DirListing,
  type FsEntry,
  type NodeState,
} from "@/lib/fs-browser";

const STATE_TONE: Record<NodeState, string> = {
  open: "text-signal border-signal/40",
  denied: "text-warn border-warn/40",
  absent: "text-muted-foreground border-border",
  unknown: "text-scan border-scan/30",
};

const STATE_LABEL: Record<NodeState, string> = {
  open: "readable",
  denied: "exists · not readable",
  absent: "not present",
  unknown: "not probed",
};

/**
 * Whole-device file view, root downward. Directories you are not allowed to
 * open still appear, marked with the refusal, because being told a thing is
 * off limits is different from being told it does not exist.
 */
export function FileTree() {
  const { run, state } = useBridge();
  const [path, setPath] = useState("/");
  const [listing, setListing] = useState<DirListing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roots, setRoots] = useState<Record<string, NodeState>>({});

  const linked = state === "online" || state === "agent";

  const load = useCallback(
    async (next: string) => {
      setBusy(true);
      setError(null);
      try {
        const raw = await run(listCmd(next));
        const parsed = parseListing(next, raw);
        if (parsed.state !== "open") {
          // A refused directory is still a real node — confirm it exists.
          const probe = await run(statCmd(next));
          parsed.state = probeState(probe) === "absent" ? "absent" : parsed.state;
        }
        setListing(parsed);
        setPath(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "listing failed");
      } finally {
        setBusy(false);
      }
    },
    [run],
  );

  useEffect(() => {
    if (linked && !listing && !busy) void load("/");
  }, [linked, listing, busy, load]);

  /** Probe every hidden root once, so the locked doors are visible up front. */
  const sweepRoots = useCallback(async () => {
    setBusy(true);
    const found: Record<string, NodeState> = {};
    for (const r of HIDDEN_ROOTS) {
      try {
        found[r.path] = probeState(await run(statCmd(r.path), 8000));
      } catch {
        found[r.path] = "unknown";
      }
    }
    setRoots(found);
    setBusy(false);
  }, [run]);

  if (!linked) {
    return (
      <div className="mt-2 rounded-sm border border-warn/40 bg-card/60 px-2 py-3 text-[8px] leading-relaxed text-muted-foreground">
        The file view reads the device over the bridge link, which is not up.
        Start the bridge from the tool deck, then come back — nothing here
        writes, deletes or uploads anything; it only lists.
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {crumbs(path).map((c) => (
          <button
            key={c.path}
            type="button"
            onClick={() => void load(c.path)}
            className="rounded-sm border border-border bg-card/70 px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-scan active:bg-accent"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => void load(parentPath(path))}
          className="rounded-sm border border-border bg-card/70 px-2 py-1 text-[8px] uppercase tracking-[0.2em] text-muted-foreground active:bg-accent"
        >
          up
        </button>
        <button
          type="button"
          onClick={() => void load(path)}
          className="rounded-sm border border-signal/50 bg-card/70 px-2 py-1 text-[8px] uppercase tracking-[0.2em] text-signal active:bg-accent"
        >
          {busy ? "…" : "reload"}
        </button>
        <button
          type="button"
          onClick={() => void sweepRoots()}
          className="rounded-sm border border-warn/50 bg-card/70 px-2 py-1 text-[8px] uppercase tracking-[0.2em] text-warn active:bg-accent"
        >
          hidden roots
        </button>
      </div>

      {error ? (
        <p className="rounded-sm border border-alert/50 px-2 py-1 text-[8px] text-alert">{error}</p>
      ) : null}

      {listing ? (
        <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground">
          {listing.entries.length} entries · {STATE_LABEL[listing.state]}
          {listing.refusal ? ` · ${listing.refusal}` : ""}
        </p>
      ) : null}

      {Object.keys(roots).length > 0 ? (
        <ul className="space-y-1">
          {HIDDEN_ROOTS.map((r) => {
            const s = roots[r.path] ?? "unknown";
            return (
              <li key={r.path}>
                <button
                  type="button"
                  onClick={() => void load(r.path)}
                  className={`w-full rounded-sm border bg-card/70 px-2 py-1 text-left active:bg-accent ${STATE_TONE[s]}`}
                >
                  <span className="block truncate text-[9px] font-bold">{r.path}</span>
                  <span className="block truncate text-[7px] uppercase tracking-widest text-muted-foreground">
                    {STATE_LABEL[s]} · {r.why}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <ul className="space-y-1">
        {(listing?.entries ?? []).map((e) => (
          <FsRow key={e.path} entry={e} onOpen={() => void load(e.path)} />
        ))}
        {listing && listing.entries.length === 0 ? (
          <li className="rounded-sm border border-warn/40 bg-card/60 px-2 py-3 text-center text-[8px] uppercase tracking-widest text-warn">
            {listing.state === "denied"
              ? "this directory exists — the system refuses to open it"
              : "empty"}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function FsRow({ entry, onOpen }: { entry: FsEntry; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={entry.dir ? onOpen : undefined}
        className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border bg-card/70 px-2 py-1 text-left ${
          entry.dir ? "border-signal/40 active:bg-accent" : "border-border"
        }`}
      >
        <span className="shrink-0 text-[7px] uppercase tracking-widest text-muted-foreground">
          {entry.dir ? "dir" : entry.link ? "lnk" : "f"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] text-foreground">{entry.name}</span>
          <span className="block truncate text-[7px] uppercase tracking-wider text-muted-foreground">
            {entry.perms} · {entry.owner}:{entry.group} · {entry.size}b · {entry.modified}
            {entry.link ? ` → ${entry.link}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{entry.dir ? "›" : ""}</span>
      </button>
    </li>
  );
}
