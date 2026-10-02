import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deviceKind, flushQueue, logScan, useCloud } from "@/lib/cloud";

/**
 * Network state of this handset: who it is signed in as, which other devices
 * share the account, how many rows have landed and what is still queued on
 * the wrist waiting for a link.
 */
export default function CloudPanel() {
  const { session, loading, online, queued, devices, events, lastEvent, error, refresh } =
    useCloud();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const probe = async () => {
    setBusy(true);
    const r = await logScan({
      kind: "probe",
      label: `${deviceKind()} link test`,
      payload: { ua: navigator.userAgent, at: Date.now() },
    });
    setNote(r === "synced" ? "write landed in cloud" : "queued — no link / not signed in");
    refresh();
    setBusy(false);
  };

  const flush = async () => {
    setBusy(true);
    const n = await flushQueue();
    setNote(n ? `flushed ${n} queued writes` : "nothing to flush");
    refresh();
    setBusy(false);
  };

  const tone = !session ? "text-warn" : error ? "text-alert" : online ? "text-signal" : "text-warn";
  const label = loading
    ? "checking…"
    : !session
      ? "not signed in"
      : error
        ? "cloud error"
        : online
          ? "synced"
          : "offline · queueing";

  return (
    <section className="mt-3 border-t border-border pt-2">
      <p className="flex justify-between text-[8px] uppercase tracking-widest text-muted-foreground">
        <span>network</span>
        <span className={tone}>{label}</span>
      </p>

      {session ? (
        <>
          <p className="truncate pt-1 text-[8px] uppercase tracking-wider text-muted-foreground">
            {session.user.email ?? session.user.id.slice(0, 8)} · this {deviceKind()}
          </p>
          <div className="mt-1 grid grid-cols-3 gap-1 text-center">
            <div className="rounded-sm border border-border/60 py-1">
              <p className="text-[11px] leading-none text-signal">{devices.length}</p>
              <p className="text-[7px] uppercase tracking-widest text-muted-foreground">devices</p>
            </div>
            <div className="rounded-sm border border-border/60 py-1">
              <p className="text-[11px] leading-none text-scan">{events}</p>
              <p className="text-[7px] uppercase tracking-widest text-muted-foreground">writes</p>
            </div>
            <div className="rounded-sm border border-border/60 py-1">
              <p
                className={`text-[11px] leading-none ${queued ? "text-warn" : "text-muted-foreground"}`}
              >
                {queued}
              </p>
              <p className="text-[7px] uppercase tracking-widest text-muted-foreground">queued</p>
            </div>
          </div>
          <ul className="mt-1">
            {devices.slice(0, 4).map((d) => (
              <li
                key={d.device_key}
                className="flex justify-between border-b border-border/40 py-0.5 text-[8px] uppercase tracking-wider"
              >
                <span className="truncate text-foreground">{d.label}</span>
                <span className="shrink-0 text-muted-foreground">
                  {new Date(d.last_seen).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-1 grid grid-cols-3 gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void probe()}
              className="rounded-sm border border-signal py-1 text-[8px] uppercase tracking-widest text-signal active:bg-accent disabled:opacity-40"
            >
              test write
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void flush()}
              className="rounded-sm border border-scan py-1 text-[8px] uppercase tracking-widest text-scan active:bg-accent disabled:opacity-40"
            >
              flush
            </button>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="rounded-sm border border-border py-1 text-[8px] uppercase tracking-widest text-muted-foreground active:bg-accent"
            >
              sign out
            </button>
          </div>
          <p className="pt-1 text-[8px] uppercase tracking-wider text-muted-foreground">
            {note ||
              (lastEvent ? `last write ${new Date(lastEvent).toLocaleString()}` : "no writes yet")}
          </p>
        </>
      ) : (
        <>
          <p className="pt-1 text-[8px] leading-snug text-muted-foreground">
            {queued
              ? `${queued} captures are held on this device. Sign in and they upload.`
              : "Sign in once to link this watch, your phone and your tablet to one account."}
          </p>
          <Link
            to="/auth"
            search={{ next: "/admin" }}
            className="mt-1 block rounded-sm border border-signal py-1.5 text-center text-[9px] uppercase tracking-widest text-signal active:bg-accent"
          >
            sign in / create account
          </Link>
        </>
      )}
      {error ? (
        <p className="break-words pt-1 text-[8px] uppercase tracking-wider text-alert">{error}</p>
      ) : null}
    </section>
  );
}
