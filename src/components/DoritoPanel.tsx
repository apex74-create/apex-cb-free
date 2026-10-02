import { useEffect, useMemo, useState } from "react";
import { useBridge } from "@/lib/bridge-hooks";
import { parseTelephony, useLiveCommand } from "@/lib/live-data";
import {
  fingerprint,
  loadCerts,
  parsePem,
  saveCerts,
  subjectCn,
  type CertAssignment,
} from "@/lib/certs";

const CMD = "shell dumpsys telephony.registry";
const SCOPES: CertAssignment["scope"][] = ["bridge", "reticulum", "pcap"];
const SIZES = [5, 10, 25];

/** Bearing triangulator with certificate assignment and a paged index. */
export default function DoritoPanel() {
  const { state } = useBridge();
  const live = useLiveCommand(CMD, parseTelephony, 8000);
  const rows = useMemo(() => live.data ?? [], [live.data]);

  const [view, setView] = useState<"index" | "ssl">("index");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [query, setQuery] = useState("");

  const [certs, setCerts] = useState<CertAssignment[]>([]);
  const [pem, setPem] = useState("");
  const [scope, setScope] = useState<CertAssignment["scope"]>("bridge");
  const [certNote, setCertNote] = useState("");

  useEffect(() => setCerts(loadCerts()), []);

  const filtered = useMemo(
    () =>
      query.trim()
        ? rows.filter(([k, v]) => `${k} ${v}`.toLowerCase().includes(query.trim().toLowerCase()))
        : rows,
    [rows, query],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * size, safePage * size + size);

  useEffect(() => setPage(0), [query, size]);

  const assign = async () => {
    const der = parsePem(pem);
    if (!der) return setCertNote("not a valid PEM certificate");
    const fp = await fingerprint(der);
    if (certs.some((c) => c.fingerprint === fp && c.scope === scope)) {
      return setCertNote("already assigned to this scope");
    }
    const next: CertAssignment[] = [
      ...certs,
      {
        id: `${fp.slice(0, 12)}-${scope}`,
        scope,
        subject: subjectCn(der),
        fingerprint: fp,
        pem: pem.trim(),
        addedAt: Date.now(),
      },
    ];
    setCerts(next);
    saveCerts(next);
    setPem("");
    setCertNote(`pinned ${fp.slice(0, 16)}… to ${scope}`);
  };

  const drop = (id: string) => {
    const next = certs.filter((c) => c.id !== id);
    setCerts(next);
    saveCerts(next);
    setCertNote("assignment removed");
  };

  return (
    <div className="no-scrollbar absolute inset-0 overflow-y-auto scan-grid p-2 pb-8">
      <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1">
        <span className="min-w-0 truncate text-[8px] uppercase tracking-widest text-muted-foreground">
          {view === "index" ? CMD : "tls assignment"}
        </span>
        <button
          type="button"
          onClick={() => setView((v) => (v === "index" ? "ssl" : "index"))}
          className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
        >
          {view === "index" ? "ssl" : "index"}
        </button>
        <button
          type="button"
          onClick={live.refresh}
          className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
        >
          {live.loading ? "…" : "sync"}
        </button>
      </div>

      {view === "index" ? (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 60))}
            placeholder="filter index"
            spellCheck={false}
            autoCapitalize="none"
            className="w-full rounded-sm border border-border bg-card/70 px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-warn/60"
          />

          <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-sm border border-border px-2 py-0.5 text-[9px] text-muted-foreground active:text-signal disabled:opacity-30"
            >
              ‹
            </button>
            <span className="truncate text-center text-[8px] uppercase tracking-widest text-muted-foreground">
              page {safePage + 1}/{pages} · {filtered.length} rows
            </span>
            <button
              type="button"
              disabled={safePage >= pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              className="rounded-sm border border-border px-2 py-0.5 text-[9px] text-muted-foreground active:text-signal disabled:opacity-30"
            >
              ›
            </button>
          </div>

          <div className="mt-1 flex gap-1">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`rounded-sm border px-1.5 py-0.5 text-[8px] uppercase tracking-widest ${
                  size === s ? "border-warn/60 text-warn" : "border-border text-muted-foreground"
                }`}
              >
                {s}/pg
              </button>
            ))}
          </div>

          {live.error ? (
            <p className="mt-2 rounded-sm border border-alert/50 bg-card/70 px-2 py-2 text-[9px] uppercase tracking-widest text-alert">
              no source · {live.error} · bridge {state}
            </p>
          ) : slice.length === 0 ? (
            <p className="mt-2 px-2 py-2 text-[9px] uppercase tracking-widest text-muted-foreground">
              {live.loading ? "reading device…" : "no rows on this page"}
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {slice.map(([label, value], i) => (
                <li
                  key={`${label}-${i}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-border bg-card/70 px-2 py-1.5"
                >
                  <span className="shrink-0 text-[8px] text-muted-foreground">
                    {safePage * size + i + 1}
                  </span>
                  <span className="min-w-0 truncate text-[10px] uppercase tracking-widest text-foreground">
                    {label}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{value}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-1">
            {SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`rounded-sm border px-1.5 py-0.5 text-[8px] uppercase tracking-widest ${
                  scope === s ? "border-scan/60 text-scan" : "border-border text-muted-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <textarea
            value={pem}
            onChange={(e) => setPem(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder="-----BEGIN CERTIFICATE-----"
            className="mt-1 w-full resize-none rounded-sm border border-border bg-card/70 px-1.5 py-1 font-mono text-[8px] text-foreground outline-none focus:border-scan/60"
          />
          <button
            type="button"
            onClick={() => void assign()}
            className="mt-1 w-full rounded-sm border border-scan/50 py-1.5 text-[9px] uppercase tracking-widest text-scan active:bg-accent"
          >
            assign certificate
          </button>
          <p className="mt-1 break-words text-[8px] uppercase tracking-wider text-muted-foreground">
            {certNote || "pem is parsed and its sha-256 fingerprint pinned to the selected scope"}
          </p>

          <ul className="mt-2 space-y-1">
            {certs.length === 0 ? (
              <li className="text-[9px] uppercase tracking-widest text-muted-foreground">
                no certificates assigned
              </li>
            ) : (
              certs.map((c) => (
                <li key={c.id} className="rounded-sm border border-border bg-card/70 px-1.5 py-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <span className="min-w-0 truncate text-[9px] text-foreground">{c.subject}</span>
                    <button
                      type="button"
                      onClick={() => drop(c.id)}
                      className="shrink-0 text-[9px] text-alert active:opacity-60"
                      aria-label={`Remove ${c.subject}`}
                    >
                      ✕
                    </button>
                  </div>
                  <span className="block truncate text-[8px] uppercase tracking-wider text-scan">
                    {c.scope}
                  </span>
                  <span className="block break-all text-[8px] text-muted-foreground">
                    {c.fingerprint}
                  </span>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}
