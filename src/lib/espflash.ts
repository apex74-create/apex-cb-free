/**
 * Browser-side ESP32 flasher (Web Serial + esptool-js).
 *
 * Targets the ESP32-2432S028 "Cheap Yellow Display" board used as the
 * NerdMiner node. Runs entirely in Chrome/Chromebook — no Linux container,
 * no bash, no adb. A bricked board recovers by holding BOOT while the
 * serial port is opened, then erasing flash before writing.
 */

export type FlashPart = { address: number; url: string; label: string };

/** Firmware sets we can pull straight from a release/repo URL. */
export type FirmwareSet = {
  key: string;
  label: string;
  note: string;
  /** Single merged .bin at 0x0 is the safest recovery path. */
  parts: FlashPart[];
};

export const CYD_BAUD = [115200, 230400, 460800, 921600] as const;

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

async function fetchBinary(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

export type FlashEvents = {
  log: (line: string) => void;
  progress: (pct: number) => void;
};

export type FlashSession = {
  chip: string;
  mac: string;
  erase: () => Promise<void>;
  write: (parts: FlashPart[]) => Promise<void>;
  close: () => Promise<void>;
};

/** Prompts for a port, syncs with the ROM bootloader and returns a session. */
export async function openEspSession(baudrate: number, ev: FlashEvents): Promise<FlashSession> {
  if (!isWebSerialSupported())
    throw new Error("Web Serial unavailable — use Chrome/Chromebook over https");

  const { ESPLoader, Transport } = await import("esptool-js");
  const serial = (navigator as unknown as { serial: { requestPort: () => Promise<unknown> } })
    .serial;
  const port = (await serial.requestPort()) as ConstructorParameters<typeof Transport>[0];
  const transport = new Transport(port, true);

  const terminal = {
    clean: () => {},
    writeLine: (data: string) => ev.log(data),
    write: (data: string) => ev.log(data.replace(/\r/g, "").trim()),
  };

  const loader = new ESPLoader({ transport, baudrate, terminal });
  const chip = await loader.main();
  let mac = "";
  try {
    mac = await loader.chip.readMac(loader);
  } catch {
    mac = "unknown";
  }

  return {
    chip: String(chip),
    mac,
    erase: async () => {
      ev.log("erasing flash…");
      await loader.eraseFlash();
      ev.log("flash erased");
    },
    write: async (parts) => {
      const fileArray: { data: Uint8Array; address: number }[] = [];
      for (const part of parts) {
        ev.log(`fetch ${part.label}`);
        fileArray.push({ data: await fetchBinary(part.url), address: part.address });
      }
      await loader.writeFlash({
        fileArray,
        flashSize: "keep",
        flashMode: "keep",
        flashFreq: "keep",
        eraseAll: false,
        compress: true,
        reportProgress: (_i: number, written: number, total: number) =>
          ev.progress(total ? Math.round((written / total) * 100) : 0),
      });
      ev.log("write complete — resetting");
      await loader.after();
    },
    close: async () => {
      try {
        await transport.disconnect();
      } catch {
        /* port already gone */
      }
    },
  };
}
