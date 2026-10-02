/**
 * USB cable bridge — replaces ADB for radio nodes.
 *
 * Plug an ESP32 node or serial radio interface into the phone/Chromebook and
 * tap "Plug in radio". Chromebooks/desktop use Web Serial (the OS already
 * owns the serial driver); Android Chrome uses WebUSB with CDC-ACM directly.
 * Frames are newline-terminated JSON carrying a Tri-Star header (hex), text
 * only — voice clips are too large for serial radio links.
 *
 * CB legal line: if the node keys a CB transmitter, it must send in the clear.
 * These frames are plain JSON — never encrypted on this path.
 */
import { deliver, registerLink, unregisterLink, type LinkFrame } from "@/lib/cb-links";
import { parseAprsWx, putStation } from "@/lib/wx-stations";
import { pushRadioAlert } from "@/lib/radio-alerts";
import { packTriStarHeader } from "@/lib/engines/tristar-addressing";

export type UsbState = "idle" | "connecting" | "linked" | "error";
type Writer = (line: string) => Promise<void>;

let write: Writer | null = null;
let closer: (() => Promise<void>) | null = null;

/** Local sector coordinate — 0 until the node announces its own. */
let localCoord = 0n;

export function usbSupport(): "serial" | "webusb" | "none" {
  if (typeof navigator === "undefined") return "none";
  if ("serial" in navigator) return "serial";
  if ("usb" in navigator) return "webusb";
  return "none";
}

function hex(b: Uint8Array) {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function handleLine(line: string) {
  try {
    const m = JSON.parse(line) as Partial<LinkFrame> & { t?: string; coord?: string; raw?: string; event?: string; area?: string };
    if (m.t === "hello" && m.coord) localCoord = BigInt(m.coord);
    if (m.t === "wx" && m.raw) {
      const o = parseAprsWx(String(m.raw), Number(m.ts ?? Date.now()));
      if (o) {
        putStation(o);
        // share with phones that have no receiver
        deliver({ id: `wx-${o.id}-${o.at}`, ch: 0, from: o.name, kind: "text", body: `WX1:${String(m.raw)}`, ts: o.at }, "usb");
      }
      return;
    }
    if (m.t === "alert" && m.event) {
      pushRadioAlert(String(m.event), String(m.area ?? ""));
      return;
    }
    if (m.t !== "cb" || !m.body) return;
    deliver(
      {
        id: String(m.id ?? `${Date.now()}-${Math.random()}`),
        ch: Number(m.ch ?? 19),
        from: String(m.from ?? "NODE"),
        kind: "text",
        body: String(m.body),
        ts: Number(m.ts ?? Date.now()),
      },
      "usb",
    );
  } catch {
    /* noise on the line */
  }
}

function lineReader() {
  const dec = new TextDecoder();
  let buf = "";
  return (chunk: Uint8Array) => {
    buf += dec.decode(chunk, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) !== -1) {
      const l = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (l) handleLine(l);
    }
    if (buf.length > 65536) buf = "";
  };
}

function attach(onState: (s: UsbState, msg?: string) => void) {
  registerLink({
    kind: "usb",
    carriesVoice: false,
    send: (f) => {
      const tri = hex(packTriStarHeader(localCoord));
      void write?.(JSON.stringify({ t: "cb", tri, ...f }) + "\n").catch(() => onState("error", "write failed"));
    },
  });
  void write?.(JSON.stringify({ t: "hello", app: "apex-cb" }) + "\n");
  onState("linked");
}

async function viaSerial(onState: (s: UsbState, msg?: string) => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serial = (navigator as any).serial;
  const port = await serial.requestPort();
  await port.open({ baudRate: 115200 });
  const w = port.writable.getWriter();
  const enc = new TextEncoder();
  write = (l) => w.write(enc.encode(l));
  const reader = port.readable.getReader();
  const feed = lineReader();
  let open = true;
  closer = async () => {
    open = false;
    await reader.cancel().catch(() => {});
    w.releaseLock();
    await port.close().catch(() => {});
  };
  attach(onState);
  void (async () => {
    while (open) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) break;
      if (value) feed(value);
    }
    disconnectUsb();
    onState("idle", "cable unplugged");
  })();
}

async function viaWebUsb(onState: (s: UsbState, msg?: string) => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usb = (navigator as any).usb;
  const dev = await usb.requestDevice({
    filters: [{ classCode: 0x02 }, { classCode: 0x0a }, { vendorId: 0x303a }, { vendorId: 0x10c4 }],
  });
  await dev.open();
  if (dev.configuration === null) await dev.selectConfiguration(1);
  // Find a data interface with bulk IN + OUT endpoints.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null, inEp = 0, outEp = 0, ctrlIf = 0;
  for (const itf of dev.configuration.interfaces) {
    const alt = itf.alternates[0];
    if (alt.interfaceClass === 0x02) ctrlIf = itf.interfaceNumber;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bi = alt.endpoints.find((e: any) => e.type === "bulk" && e.direction === "in");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bo = alt.endpoints.find((e: any) => e.type === "bulk" && e.direction === "out");
    if (bi && bo) {
      data = itf;
      inEp = bi.endpointNumber;
      outEp = bo.endpointNumber;
    }
  }
  if (!data) throw new Error("This device has no data port the browser can open.");
  await dev.claimInterface(data.interfaceNumber);
  if (data.alternates[0].interfaceClass === 0x0a) {
    // CDC-ACM: 115200 8N1, then raise DTR/RTS so the node starts talking.
    try {
      await dev.claimInterface(ctrlIf).catch(() => {});
      const lc = new Uint8Array([0x00, 0xc2, 0x01, 0x00, 0, 0, 8]);
      await dev.controlTransferOut({ requestType: "class", recipient: "interface", request: 0x20, value: 0, index: ctrlIf }, lc);
      await dev.controlTransferOut({ requestType: "class", recipient: "interface", request: 0x22, value: 0x03, index: ctrlIf });
    } catch {
      /* some nodes don't need it */
    }
  } else if (dev.vendorId === 0x10c4) {
    // CP210x: enable UART, 115200 baud.
    await dev.controlTransferOut({ requestType: "vendor", recipient: "interface", request: 0x00, value: 0x01, index: data.interfaceNumber });
    const baud = new Uint8Array(new Uint32Array([115200]).buffer);
    await dev.controlTransferOut({ requestType: "vendor", recipient: "interface", request: 0x1e, value: 0, index: data.interfaceNumber }, baud);
  }
  const enc = new TextEncoder();
  write = async (l) => {
    await dev.transferOut(outEp, enc.encode(l));
  };
  const feed = lineReader();
  let open = true;
  closer = async () => {
    open = false;
    await dev.close().catch(() => {});
  };
  attach(onState);
  void (async () => {
    while (open) {
      try {
        const r = await dev.transferIn(inEp, 512);
        if (r.data?.byteLength) feed(new Uint8Array(r.data.buffer));
      } catch {
        break;
      }
    }
    disconnectUsb();
    onState("idle", "cable unplugged");
  })();
}

/** Must run from a tap. */
export async function connectUsb(onState: (s: UsbState, msg?: string) => void) {
  const mode = usbSupport();
  if (mode === "none") throw new Error("This browser can't open USB devices — use Chrome on Android or a Chromebook.");
  onState("connecting");
  try {
    if (mode === "serial") await viaSerial(onState);
    else await viaWebUsb(onState);
  } catch (err) {
    const e = err as DOMException;
    if (e?.name === "NotFoundError") return onState("idle", "no device picked");
    if (e?.name === "SecurityError") return onState("error", "the phone blocked this device type");
    onState("error", e?.message || "could not open the device");
  }
}

export function disconnectUsb() {
  unregisterLink("usb");
  write = null;
  const c = closer;
  closer = null;
  void c?.();
}
