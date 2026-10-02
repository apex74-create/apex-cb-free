/**
 * Cloud sync spine.
 *
 * Every device — watch, phone or tablet — registers itself once against the
 * signed-in account and then writes its telemetry (scans, captures, session
 * reports, entitlement) to the shared backend. Writes are queued locally when
 * the link is down or nobody is signed in, and flushed the moment either comes
 * back, so a field capture on the wrist is never lost and shows up on the phone.
 */

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type DeviceKind = "watch" | "phone" | "tablet" | "desktop";

const KEY_DEVICE = "apex.device.key";
const KEY_QUEUE = "apex.cloud.queue";

/** Stable per-install id so the same handset keeps one row forever. */
export function deviceKey(): string {
  if (typeof window === "undefined") return "ssr";
  let k = localStorage.getItem(KEY_DEVICE);
  if (!k) {
    k = crypto.randomUUID();
    localStorage.setItem(KEY_DEVICE, k);
  }
  return k;
}

/** Watch / phone / tablet split drives both the UI density and the label. */
export function deviceKind(): DeviceKind {
  if (typeof window === "undefined") return "watch";
  const w = window.innerWidth;
  const h = window.innerHeight;
  const min = Math.min(w, h);
  const max = Math.max(w, h);
  const touch = navigator.maxTouchPoints > 0;
  if (max <= 480 && Math.abs(w - h) < 120) return "watch";
  if (!touch && min >= 700) return "desktop";
  if (min >= 600) return "tablet";
  return "phone";
}

export function deviceLabel(): string {
  const kind = deviceKind();
  const size = typeof window === "undefined" ? "?" : `${window.innerWidth}x${window.innerHeight}`;
  return `${kind} ${size}`;
}

/* ---------------------------------------------------------------- session */

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

/* ------------------------------------------------------------ write queue */

type QueuedScan = {
  kind: string;
  label?: string | null;
  lat?: number | null;
  lon?: number | null;
  payload?: Record<string, unknown>;
  created_at: string;
};

function readQueue(): QueuedScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_QUEUE);
    return raw ? (JSON.parse(raw) as QueuedScan[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedScan[]) {
  if (typeof window === "undefined") return;
  // Cap so an offline week can't fill the watch's storage.
  localStorage.setItem(KEY_QUEUE, JSON.stringify(q.slice(-500)));
  window.dispatchEvent(new CustomEvent("apexCloudQueue", { detail: q.length }));
}

export const queuedCount = () => readQueue().length;

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Register (or refresh) this handset against the account. */
export async function registerDevice(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await supabase.from("devices").upsert(
    {
      user_id: userId,
      device_key: deviceKey(),
      kind: deviceKind(),
      label: deviceLabel(),
      user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
      screen: typeof window === "undefined" ? null : `${window.innerWidth}x${window.innerHeight}`,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "user_id,device_key" },
  );
}

/** Push a scan / capture / telemetry row. Falls back to the offline queue. */
export async function logScan(ev: {
  kind: string;
  label?: string | null;
  lat?: number | null;
  lon?: number | null;
  payload?: Record<string, unknown>;
}): Promise<"synced" | "queued"> {
  const row: QueuedScan = { ...ev, created_at: new Date().toISOString() };
  const userId = await currentUserId();
  if (!userId || (typeof navigator !== "undefined" && !navigator.onLine)) {
    writeQueue([...readQueue(), row]);
    return "queued";
  }
  const { error } = await supabase.from("scan_events").insert({
    user_id: userId,
    device_key: deviceKey(),
    kind: row.kind,
    label: row.label ?? null,
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    payload: (row.payload ?? {}) as never,
    created_at: row.created_at,
  });
  if (error) {
    writeQueue([...readQueue(), row]);
    return "queued";
  }
  return "synced";
}

/** Drain everything captured while offline / signed out. */
export async function flushQueue(): Promise<number> {
  const userId = await currentUserId();
  const pending = readQueue();
  if (!userId || pending.length === 0) return 0;
  const { error } = await supabase.from("scan_events").insert(
    pending.map((r) => ({
      user_id: userId,
      device_key: deviceKey(),
      kind: r.kind,
      label: r.label ?? null,
      lat: r.lat ?? null,
      lon: r.lon ?? null,
      payload: (r.payload ?? {}) as never,
      created_at: r.created_at,
    })),
  );
  if (error) return 0;
  writeQueue([]);
  return pending.length;
}

/** Store a bridge/session report so it can be pulled up on another device. */
export async function saveSessionReport(title: string, report: string): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  const { error } = await supabase
    .from("sessions")
    .insert({ user_id: userId, device_key: deviceKey(), title, report });
  return !error;
}

/* ----------------------------------------------------------- entitlement */

export async function fetchCloudTier(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from("entitlements")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.tier ?? null;
}

/**
 * Entitlements are server-owned: the tier is set by the sign-up trigger and by
 * trusted server-side payment processing. Clients can read it but never write
 * it, so this is a no-op kept for call-site compatibility.
 */
export async function pushCloudTier(_tier: string): Promise<boolean> {
  return false;
}

/* --------------------------------------------------------------- summary */

export type CloudSummary = {
  session: Session | null;
  loading: boolean;
  online: boolean;
  queued: number;
  devices: { device_key: string; kind: string; label: string; last_seen: string }[];
  events: number;
  lastEvent: string | null;
  error: string | null;
  refresh: () => void;
};

export function useCloud(): CloudSummary {
  const { session, loading } = useSession();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [devices, setDevices] = useState<CloudSummary["devices"]>([]);
  const [events, setEvents] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    const q = () => setQueued(queuedCount());
    q();
    window.addEventListener("apexCloudQueue", q);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("apexCloudQueue", q);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setDevices([]);
      setEvents(0);
      setLastEvent(null);
      return;
    }
    let live = true;
    void (async () => {
      try {
        await registerDevice();
        const flushed = await flushQueue();
        if (flushed) setQueued(0);
        const [d, e] = await Promise.all([
          supabase
            .from("devices")
            .select("device_key,kind,label,last_seen")
            .order("last_seen", { ascending: false }),
          supabase
            .from("scan_events")
            .select("created_at", { count: "exact" })
            .order("created_at", { ascending: false })
            .limit(1),
        ]);
        if (!live) return;
        if (d.error) throw d.error;
        setDevices(d.data ?? []);
        setEvents(e.count ?? 0);
        setLastEvent(e.data?.[0]?.created_at ?? null);
        setError(null);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "cloud unreachable");
      }
    })();
    return () => {
      live = false;
    };
  }, [session, nonce]);

  // Cross-device push: another handset writing a scan bumps this one live.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel("apex-sync")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_events" },
        (payload) => {
          setEvents((n) => n + 1);
          const created = (payload.new as { created_at?: string }).created_at;
          if (created) setLastEvent(created);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session]);

  return { session, loading, online, queued, devices, events, lastEvent, error, refresh };
}
