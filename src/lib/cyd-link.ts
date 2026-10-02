/**
 * CYD paired receiver link (ESP32-2432S028 "cheap yellow display").
 *
 * The board runs any passive survey sketch that prints one line per beacon:
 *   AP,<bssid>,<ssid>,<freq_mhz>,<rssi>
 * We only read. Nothing is ever written to the radio, so a paired board is a
 * second set of ears on 2.4 GHz, not a transmitter.
 */

import { estimateDistance, type AccessPoint } from "@/lib/live-data";

type SerialPortLike = {
  open: (opts: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
};

type SerialLike = {
  requestPort: () => Promise<SerialPortLike>;
};

export const serialSupported = () => typeof navigator !== "undefined" && "serial" in navigator;

export function parseCydLine(line: string): AccessPoint | null {
  const parts = line.trim().split(",");
  if (parts.length < 5 || parts[0]!.toUpperCase() !== "AP") return null;
  const [, bssid, ssid, freq, rssi] = parts;
  const f = Number(freq);
  const r = Number(rssi);
  if (!bssid || !Number.isFinite(f) || !Number.isFinite(r)) return null;
  return {
    bssid: bssid.toLowerCase(),
    ssid: ssid?.trim() || "<hidden>",
    freq: f,
    rssi: r,
    flags: "",
    distance: estimateDistance(r, f),
  };
}

export type CydSession = {
  stop: () => void;
};

/** Opens the board and streams parsed beacons until stopped. */
export async function pairCyd(
  onBeacon: (ap: AccessPoint) => void,
  onError: (message: string) => void,
  baudRate = 115200,
): Promise<CydSession> {
  const serial = (navigator as unknown as { serial?: SerialLike }).serial;
  if (!serial) throw new Error("Web Serial is unavailable in this browser");

  const port = await serial.requestPort();
  await port.open({ baudRate });

  let stopped = false;
  const reader = port.readable?.getReader();
  if (!reader) throw new Error("CYD port has no readable stream");

  void (async () => {
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const ap = parseCydLine(line);
          if (ap) onBeacon(ap);
        }
      }
    } catch (e) {
      if (!stopped) onError(e instanceof Error ? e.message : String(e));
    } finally {
      try {
        reader.releaseLock();
        await port.close();
      } catch {
        /* port already gone */
      }
    }
  })();

  return {
    stop: () => {
      stopped = true;
      void reader.cancel().catch(() => undefined);
    },
  };
}
