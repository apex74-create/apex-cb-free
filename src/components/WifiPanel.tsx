import { useCallback, useEffect, useRef, useState } from "react";
import { logScan } from "@/lib/cloud";
import { useBridge } from "@/lib/bridge-hooks";
import {
  WIFI_SCAN_CMD,
  WIFI_START_SCAN_CMD,
  WIFI_STATE_CMD,
  bandOf,
  bars,
  parseScanResults,
  parseWifiState,
  type WifiAp,
  type WifiLink,
} from "@/lib/wifi";

/**
 * Live Wi-Fi readout on the bridge screen: the association the phone is on
 * right now plus every AP its radio can hear. Everything comes from real
 * `dumpsys wifi` / `cmd wifi list-scan-results` output over the bridge.
 */
export default function WifiPanel() {
  const { state, run } = useBridge();
  const live = state === "online";

  const [link, setLink] = useState<WifiLink | null>(null);
  const [aps, setAps] = useState<WifiAp[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (rescan = false) => {
      setBusy(true);
      setErr(null);
      try {
        if (rescan) {
          await run(WIFI_START_SCAN_CMD).catch(() => "");
          await new Promise((r) => setTimeout(r, 2500));
        }
        const [stateOut, scanOut] = await Promise.all([run(WIFI_STATE_CMD), run(WIFI_SCAN_CMD)]);
        if (!mounted.current) return;
        const parsedLink = parseWifiState(stateOut);
        const parsedAps = parseScanResults(scanOut);
        setLink(parsedLink);
        setAps(parsedAps);
        setAt(Date.now());
        // Persist the capture to the account so it shows up on the phone too.
        if (parsedAps.length) {
          void logScan({
            kind: "wifi_scan",
            label: parsedLink?.ssid ?? `${parsedAps.length} ap`,
            payload: { link: parsedLink, aps: parsedAps.slice(0, 40) },
          });
        }
      } catch (e) {
        if (mounted.current) setErr(e instanceof Error ? e.message : "wifi read failed");
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [run],
  );

  // First read as soon as the link comes up, then keep it warm.
  useEffect(() => {
    if (!live) return;
    void refresh(false);
    const t = setInterval(() => void refresh(false), 20000);
    return () => clearInterval(t);
  }, [live, refresh]);

  return (
    <div className="mb-2 rounded-sm border border-scan/60 bg-card/60 p-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="truncate text-[8px] uppercase tracking-widest text-scan">
          wifi {busy ? "· reading…" : at ? `· ${new Date(at).toLocaleTimeString()}` : ""}
        </p>
        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={!live || busy}
          className="shrink-0 rounded-sm border border-scan px-1.5 py-0.5 text-[7px] uppercase tracking-widest text-scan active:bg-accent disabled:opacity-40"
        >
          rescan
        </button>
      </div>

      {!live ? (
        <p className="mt-1 text-[8px] uppercase leading-snug text-warn">
          no agent link — wifi comes from the phone over adb. connect a bridge agent above.
        </p>
      ) : err ? (
        <p className="mt-1 whitespace-pre-wrap text-[8px] uppercase leading-snug text-alert">
          {err}
        </p>
      ) : (
        <>
          <div className="mt-1 rounded-sm border border-border px-1.5 py-1">
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-signal">
              {link?.ssid ?? (link?.enabled === false ? "wifi off" : "not associated")}
            </p>
            <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
              {[
                link?.rssi !== null && link?.rssi !== undefined ? `${link.rssi} dBm` : null,
                link?.freqMhz ? bandOf(link.freqMhz) : null,
                link?.speedMbps ? `${link.speedMbps} Mbps` : null,
                link?.ip,
                link?.bssid,
              ]
                .filter(Boolean)
                .join(" · ") || "no association details"}
            </p>
          </div>

          <ul className="mt-1 space-y-0.5">
            {aps.length === 0 ? (
              <li className="text-[8px] uppercase tracking-widest text-muted-foreground">
                no scan results — tap rescan
              </li>
            ) : (
              aps.slice(0, 12).map((ap) => (
                <li
                  key={ap.bssid ?? ap.ssid}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 border-b border-border/40 py-0.5"
                >
                  <span className="truncate text-[9px] text-foreground">
                    {ap.ssid}
                    {ap.flags?.includes("WPA") || ap.flags?.includes("RSN") ? "" : " ·open"}
                  </span>
                  <span className="shrink-0 text-[8px] uppercase tracking-wider text-scan">
                    {"▁▃▅▇".slice(0, bars(ap.rssi)) || "·"} {ap.rssi ?? "?"} {bandOf(ap.freqMhz)}
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
