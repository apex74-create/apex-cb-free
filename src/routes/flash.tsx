import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  CYD_BAUD,
  isWebSerialSupported,
  openEspSession,
  type FlashPart,
  type FlashSession,
} from "@/lib/espflash";

export const Route = createFileRoute("/flash")({
  head: () => ({
    meta: [
      { title: "ESP Flasher — Apex Signal Watch" },
      {
        name: "description",
        content:
          "Flash and unbrick the ESP32-2432S028 NerdMiner board straight from Chrome with Web Serial — no Linux container or bash needed.",
      },
      { property: "og:title", content: "ESP Flasher — Apex Signal Watch" },
      {
        property: "og:description",
        content:
          "Web Serial recovery deck for the ESP32 CYD board: erase, write firmware by URL, live progress log.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FlashView,
});

const DEFAULT_PARTS = "0x0 https://example.com/firmware-merged.bin";

function parseParts(text: string): FlashPart[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [addr, url] = line.split(/\s+/);
      if (!addr || !url) throw new Error(`line ${i + 1}: expected "<addr> <url>"`);
      const address = Number(addr);
      if (!Number.isFinite(address)) throw new Error(`line ${i + 1}: bad address ${addr}`);
      return { address, url, label: `${addr} ${url.split("/").pop() ?? url}` };
    });
}

function FlashView() {
  const sessionRef = useRef<FlashSession | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [baud, setBaud] = useState<number>(921600);
  const [parts, setParts] = useState(DEFAULT_PARTS);
  const [log, setLog] = useState<string[]>([]);

  const push = useCallback((line: string) => {
    if (!line) return;
    setLog((l) => [line, ...l].slice(0, 200));
  }, []);

  const connect = useCallback(async () => {
    setBusy("connect");
    try {
      const s = await openEspSession(baud, { log: push, progress: setPct });
      sessionRef.current = s;
      setInfo(`${s.chip} · ${s.mac}`);
      push(`connected: ${s.chip}`);
    } catch (err) {
      push(err instanceof Error ? err.message : "connect failed");
    } finally {
      setBusy(null);
    }
  }, [baud, push]);

  const erase = useCallback(async () => {
    if (!sessionRef.current) return;
    setBusy("erase");
    try {
      await sessionRef.current.erase();
    } catch (err) {
      push(err instanceof Error ? err.message : "erase failed");
    } finally {
      setBusy(null);
    }
  }, [push]);

  const write = useCallback(async () => {
    if (!sessionRef.current) return;
    setBusy("write");
    setPct(0);
    try {
      await sessionRef.current.write(parseParts(parts));
    } catch (err) {
      push(err instanceof Error ? err.message : "write failed");
    } finally {
      setBusy(null);
    }
  }, [parts, push]);

  const disconnect = useCallback(async () => {
    await sessionRef.current?.close();
    sessionRef.current = null;
    setInfo(null);
    push("port released");
  }, [push]);

  const supported = isWebSerialSupported();
  const live = info !== null;

  return (
    <main className="relative flex h-app w-full flex-col overflow-hidden bg-background">
      <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border face-pad py-1.5">
        <Link
          to="/app"
          aria-label="Back to gallery"
          className="shrink-0 px-1 text-[12px] leading-none text-muted-foreground active:text-signal"
        >
          ‹
        </Link>
        <h1 className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-signal">
          ESP FLASHER
        </h1>
        <span className="shrink-0 text-[8px] uppercase tracking-widest text-muted-foreground">
          CYD
        </span>
      </header>

      <div className="shrink-0 border-b border-border face-pad py-1">
        <p
          className={`truncate text-[9px] uppercase tracking-widest ${live ? "text-signal" : "text-warn"}`}
        >
          {live ? `● ${info}` : supported ? "○ no port" : "○ web serial unsupported"}
        </p>
        <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
          {supported
            ? "hold BOOT while connecting a bricked board"
            : "open in chrome / chromebook over https"}
        </p>
      </div>

      <section className="no-scrollbar min-h-0 flex-1 overflow-y-auto face-pad py-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {CYD_BAUD.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBaud(b)}
              disabled={live}
              className={`rounded-sm border px-1.5 py-0.5 text-[8px] uppercase tracking-widest disabled:opacity-40 ${
                b === baud ? "border-signal text-signal" : "border-border text-muted-foreground"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[repeat(var(--face-cols,2),minmax(0,1fr))] gap-1.5">
          <button
            type="button"
            onClick={() => void (live ? disconnect() : connect())}
            disabled={!supported || busy !== null}
            className="rounded-sm border border-scan bg-card/70 px-2 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-scan active:bg-accent disabled:opacity-40"
          >
            {busy === "connect" ? "· opening" : live ? "release port" : "connect board"}
          </button>
          <button
            type="button"
            onClick={() => void erase()}
            disabled={!live || busy !== null}
            className="rounded-sm border border-alert bg-card/70 px-2 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-alert active:bg-accent disabled:opacity-40"
          >
            {busy === "erase" ? "· erasing" : "! erase flash"}
          </button>
          <button
            type="button"
            onClick={() => void write()}
            disabled={!live || busy !== null}
            className="col-span-full rounded-sm border border-signal bg-card/70 px-2 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-signal active:bg-accent disabled:opacity-40"
          >
            {busy === "write" ? `· writing ${pct}%` : "! write firmware"}
          </button>
        </div>

        <label className="mt-2 block text-[8px] uppercase tracking-widest text-muted-foreground">
          parts — one “address url” per line
          <textarea
            value={parts}
            onChange={(e) => setParts(e.target.value)}
            spellCheck={false}
            rows={4}
            className="mt-1 w-full rounded-sm border border-border bg-card/60 p-1.5 text-[9px] leading-snug text-signal outline-none focus:border-signal"
          />
        </label>

        <div className="mt-2 rounded-sm border border-border bg-card/60 p-1.5">
          <p className="mb-1 text-[8px] uppercase tracking-widest text-scan">serial log</p>
          <pre className="no-scrollbar max-h-48 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-snug text-signal">
            {log.length ? log.join("\n") : "idle"}
          </pre>
        </div>
      </section>
    </main>
  );
}
