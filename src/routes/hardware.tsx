import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useBridge } from "@/lib/bridge-context";
import {
  bluetoothCaps,
  btCmd,
  btProfilesCmd,
  featuresCmd,
  memCmd,
  parseBluetooth,
  parseFeatures,
  parseMemGb,
  parseProfiles,
  parseProps,
  parseStorage,
  propsCmd,
  radioCaps,
  storageCmd,
  wifiCmd,
  type BtInfo,
  type CapRow,
} from "@/lib/hardware";

export const Route = createFileRoute("/hardware")({
  head: () => ({
    meta: [
      { title: "Hardware Inventory — Apex Signal Watch" },
      {
        name: "description",
        content:
          "Read the real Bluetooth, Wi-Fi, cellular and sensor capabilities off the watch over ADB: BT version, BLE peripheral support, profiles, board and radio firmware.",
      },
      { property: "og:title", content: "Hardware Inventory — Apex Signal Watch" },
      {
        property: "og:description",
        content:
          "Live capability probe of the LOKMAT 4G watch — no spec-sheet guesswork, only what the device reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HardwareView,
});

type Snapshot = {
  props: Record<string, string>;
  features: string[];
  bt: BtInfo;
  profiles: string[];
  ram: string;
  storage: string;
  wifi: string;
  raw: string;
};

function HardwareView() {
  const { state, run } = useBridge();
  const [tab, setTab] = useState<"bt" | "radio" | "board">("bt");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const probe = useCallback(async () => {
    if (state !== "online") {
      setNote("bridge offline — connect the adb link first");
      return;
    }
    setBusy(true);
    setNote("probing device…");
    try {
      const [props, feats, bt, profiles, mem, df, wifi] = await Promise.all([
        run(propsCmd).catch(() => ""),
        run(featuresCmd).catch(() => ""),
        run(btCmd).catch(() => ""),
        run(btProfilesCmd).catch(() => ""),
        run(memCmd).catch(() => ""),
        run(storageCmd).catch(() => ""),
        run(wifiCmd).catch(() => ""),
      ]);
      setSnap({
        props: parseProps(props),
        features: parseFeatures(feats),
        bt: parseBluetooth(bt),
        profiles: parseProfiles(profiles),
        ram: parseMemGb(mem),
        storage: parseStorage(df),
        wifi: wifi.trim(),
        raw: bt,
      });
      setNote("");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "probe failed");
    } finally {
      setBusy(false);
    }
  }, [run, state]);

  useEffect(() => {
    if (state === "online" && !snap && !busy) void probe();
  }, [state, snap, busy, probe]);

  const p = snap?.props ?? {};
  const btVersion =
    snap?.bt.leCodedPhy || snap?.bt.leExtendedAdvert
      ? "bluetooth 5.x stack"
      : snap?.features.includes("android.hardware.bluetooth_le")
        ? "bluetooth 4.x+ (le present)"
        : "classic only";

  return (
    <main className="face-pad flex h-app flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1">
        <Link
          to="/app"
          className="text-[10px] uppercase tracking-widest text-muted-foreground active:text-signal"
        >
          ‹ back
        </Link>
        <span className="truncate text-[10px] font-bold uppercase tracking-widest text-scan">
          Hardware
        </span>
        <button
          type="button"
          onClick={() => void probe()}
          disabled={busy}
          className="rounded-sm border border-scan/60 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-scan active:bg-accent disabled:opacity-40"
        >
          {busy ? "…" : "probe"}
        </button>
      </header>

      <nav className="grid shrink-0 grid-cols-3 gap-1 border-b border-border px-2 py-1">
        {(["bt", "radio", "board"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-sm border px-1 py-0.5 text-[9px] uppercase tracking-widest ${
              tab === t ? "border-signal text-signal" : "border-border text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {!snap && (
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {note || (state === "online" ? "reading device…" : "bridge offline — nothing read yet")}
          </p>
        )}

        {snap && tab === "bt" && (
          <>
            <Line k="stack" v={btVersion} />
            <Line
              k="adapter"
              v={snap.bt.enabled === null ? "state unknown" : snap.bt.enabled ? "on" : "off"}
            />
            {snap.bt.address && <Line k="mac" v={snap.bt.address} />}
            {snap.bt.name && <Line k="name" v={snap.bt.name} />}
            {snap.bt.maxConnected && <Line k="max audio" v={`${snap.bt.maxConnected} device(s)`} />}
            <Caps rows={bluetoothCaps(snap.features, snap.bt)} />
            {snap.profiles.length > 0 && (
              <>
                <h2 className="mt-2 text-[9px] uppercase tracking-widest text-muted-foreground">
                  profiles running
                </h2>
                <p className="break-words text-[9px] leading-snug text-signal">
                  {snap.profiles.join(" · ")}
                </p>
              </>
            )}
          </>
        )}

        {snap && tab === "radio" && (
          <>
            <Caps rows={radioCaps(snap.features)} />
            {snap.wifi && (
              <>
                <h2 className="mt-2 text-[9px] uppercase tracking-widest text-muted-foreground">
                  wifi driver
                </h2>
                <pre className="whitespace-pre-wrap break-words text-[8px] leading-snug text-muted-foreground">
                  {snap.wifi}
                </pre>
              </>
            )}
          </>
        )}

        {snap && tab === "board" && (
          <>
            <Line k="model" v={p["ro.product.model"] ?? "?"} />
            <Line k="device" v={p["ro.product.device"] ?? "?"} />
            <Line k="brand" v={p["ro.product.brand"] ?? p["ro.product.manufacturer"] ?? "?"} />
            <Line k="soc" v={p["ro.board.platform"] ?? p["ro.hardware"] ?? "?"} />
            <Line k="abi" v={p["ro.product.cpu.abi"] ?? "?"} />
            <Line
              k="android"
              v={`${p["ro.build.version.release"] ?? "?"} · sdk ${p["ro.build.version.sdk"] ?? "?"}`}
            />
            <Line k="build" v={p["ro.build.display.id"] ?? p["ro.build.id"] ?? "?"} />
            <Line k="ram" v={snap.ram || "?"} />
            <Line k="storage" v={snap.storage || "?"} />
            <Line k="radio fw" v={p["gsm.version.baseband"] ?? p["ro.baseband"] ?? "?"} />
            <Line
              k="play services"
              v={
                snap.features.includes("android.software.leanback")
                  ? "—"
                  : (p["ro.com.google.gmsversion"] ?? "not reported")
              }
            />
          </>
        )}

        {snap && note && <p className="mt-2 text-[9px] text-alert">{note}</p>}
      </div>
    </main>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-b border-border/40 py-0.5">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className="truncate text-right text-[9px] text-foreground">{v}</span>
    </div>
  );
}

function Caps({ rows }: { rows: CapRow[] }) {
  return (
    <ul className="mt-1">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-b border-border/40 py-0.5"
        >
          <span
            className={
              r.ok
                ? "text-[10px] leading-none text-signal"
                : "text-[10px] leading-none text-muted-foreground"
            }
          >
            {r.ok ? "●" : "○"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[9px] uppercase tracking-wider text-foreground">
              {r.label}
            </span>
            <span className="block truncate text-[8px] text-muted-foreground">{r.note}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
