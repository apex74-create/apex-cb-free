/**
 * Web Bluetooth client for the Apex Android GATT server.
 * TX (phone → PWA): READ | NOTIFY, newline-terminated JSON chunks.
 * RX (PWA → phone): WRITE | WRITE_NO_RESPONSE.
 * Characteristic UUIDs must match the Kotlin server.
 */
export const APEX_SERVICE = "0000ffe0-0000-1000-8000-00805f9b34fb";
export const APEX_TX = "0000ffe1-0000-1000-8000-00805f9b34fb";
export const APEX_RX = "0000ffe2-0000-1000-8000-00805f9b34fb";

type BleChar = {
  value?: DataView;
  startNotifications(): Promise<BleChar>;
  addEventListener(t: string, cb: (e: Event) => void): void;
  writeValue(v: BufferSource): Promise<void>;
  writeValueWithoutResponse?(v: BufferSource): Promise<void>;
};

export type ApexBridgeHandlers = {
  onMessage: (msg: unknown) => void;
  onStatus?: (s: string) => void;
};

let rx: BleChar | null = null;
const enc = new TextEncoder();

export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/** Must be called from a user gesture (e.g. ACTIVATE BRIDGE click). */
export async function connectApexBridge(h: ApexBridgeHandlers): Promise<string> {
  if (!bluetoothSupported()) throw new Error("This browser has no Bluetooth support.");
  const status = h.onStatus ?? (() => {});
  try {
    status("requesting device");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bt = (navigator as any).bluetooth;
    const device = await bt.requestDevice({ filters: [{ services: [APEX_SERVICE] }] });
    let tries = 0;
    device.addEventListener("gattserverdisconnected", async () => {
      rx = null;
      status("disconnected — retrying");
      while (tries < 5) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** tries++));
        try {
          const srv = await device.gatt.connect();
          const svc = await srv.getPrimaryService(APEX_SERVICE);
          rx = await svc.getCharacteristic(APEX_RX);
          tries = 0;
          status("online");
          return;
        } catch {
          /* keep trying */
        }
      }
      status("disconnected");
    });
    status("connecting");
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(APEX_SERVICE);

    const tx: BleChar = await service.getCharacteristic(APEX_TX);
    const dec = new TextDecoder();
    let buf = "";
    await tx.startNotifications();
    tx.addEventListener("characteristicvaluechanged", (e) => {
      const v = (e.target as unknown as BleChar).value;
      if (!v) return;
      buf += dec.decode(v, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        try {
          h.onMessage(JSON.parse(line));
        } catch {
          status("bad frame dropped");
        }
      }
      if (buf.length > 65536) buf = ""; // runaway guard
    });

    rx = await service.getCharacteristic(APEX_RX);
    status("online");
    return device.name ?? "Apex phone";
  } catch (err) {
    const e = err as DOMException;
    if (e?.name === "NotFoundError") throw new Error("No phone picked, or none advertising the Apex service.");
    if (e?.name === "NetworkError") throw new Error("Phone isn't advertising — open the Apex app on the phone and retry.");
    if (e?.name === "SecurityError") throw new Error("Bluetooth blocked — needs a tap and a secure (https) page.");
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function sendCommand(obj: unknown): Promise<void> {
  if (!rx) throw new Error("Bridge not connected.");
  const bytes = enc.encode(JSON.stringify(obj) + "\n");
  for (let i = 0; i < bytes.length; i += 20) {
    const chunk = bytes.slice(i, i + 20);
    if (rx.writeValueWithoutResponse) await rx.writeValueWithoutResponse(chunk);
    else await rx.writeValue(chunk);
  }
}
