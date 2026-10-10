import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { canRecord, loadCallsign, MAX_KEY_MS, openMic, tune, type PttTx } from "@/lib/ptt";
import { chirp, tailStatic, tapHaptic, prestageCadenceAudio } from "@/lib/cb-feedback";
import { CB_ROUTES } from "@/lib/cb-routes";
import { RadialKnob } from "@/components/RadialKnob";
import { playRx, RX_MAX, setLevel, useLevels } from "@/lib/cb-audio-levels";
import { setKeepAliveInfo, startKeepAlive, stopKeepAlive } from "@/lib/media-session";

/**
 * Wrist Radio: the watch-face PTT target. One still screen on the same radio
 * core as /cb (same buses, so it talks to phones and Chromebooks). No map,
 * grille, scan or animation, so it paints and stays up on watch WebViews.
 * Look: thick lines, bright amber on black, nothing moves.
 */
export const Route = createFileRoute("/wcb")({
  head: () => ({
    meta: [
      { title: "Wrist Radio — Sovereign Watch CB" },
      { name: "description", content: "Push-to-talk CB on your wrist. One big key, channel up and down, same channels as the full radio." },
      { property: "og:title", content: "Wrist Radio — Sovereign Watch CB" },
      { property: "og:description", content: "The wrist communicator: push-to-talk CB on the watch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "manifest", href: "/cb.webmanifest" }],
  }),
  component: WristCb,
});

const CH_KEY = "apex.wcb.ch";

export function WristCb({ embedded = false }: { embedded?: boolean }) {
  const [ch, setCh] = useState(19);
  const [state, setState] = useState<"joining" | "live" | "down">("joining");
  const [last, setLast] = useState<PttTx | null>(null);
  const [keyed, setKeyed] = useState(false);
  const txRef = useRef<ReturnType<typeof tune>["transmit"] | null>(null);
  const micRef = useRef<Awaited<ReturnType<typeof openMic>> | null>(null);
  const stopTimer = useRef<number | null>(null);
  const callRef = useRef("APEX");

  useEffect(() => {
    callRef.current = loadCallsign();
    const saved = Number(localStorage.getItem(CH_KEY));
    if (saved >= 1 && saved <= 40) setCh(saved);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CH_KEY, String(ch)); } catch { /* locked */ }
    // Let the wrist panel paint before the relay creates its socket. A radio
    // cannot pulse its receiver without missing calls between pulses, so keep
    // the shared tune() reconnect/heartbeat behavior once listening begins.
    let cancelled = false;
    let session: ReturnType<typeof tune> | null = null;
    let timer: number | null = null;
    setState("joining");
    const start = () => {
      if (cancelled || document.visibilityState !== "visible" || session) return;
      timer = window.setTimeout(() => {
        timer = null;
        if (cancelled || document.visibilityState !== "visible") return;
        session = tune(
          ch,
          (tx) => {
            setLast(tx);
            if (tx.kind === "voice" && tx.body.startsWith("data:audio/")) {
              const a = playRx(tx.body);
              a.onended = () => tailStatic();
              void a.play().catch(() => {});
            }
          },
          setState,
        );
        txRef.current = session.transmit;
      }, 350);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && timer === null) start();
    };
    // First animation frame commits the panel; the next allows a visible paint.
    const frame = requestAnimationFrame(() => requestAnimationFrame(start));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer !== null) clearTimeout(timer);
      txRef.current = null;
      session?.leave();
    };
  }, [ch]);

  /* Background keep-alive: first wrist gesture arms the silent media session
   * so the receiver keeps running with the screen off or another app in front. */
  const keepAliveRef = useRef(false);
  const armKeepAlive = () => {
    if (keepAliveRef.current) return;
    keepAliveRef.current = true;
    void startKeepAlive({
      channelUp: () => stepRef.current(1),
      channelDown: () => stepRef.current(-1),
      monitor: () => {},
    });
  };
  const stepRef = useRef<(d: number) => void>(() => {});

  const step = (d: number) => { armKeepAlive(); tapHaptic(); setCh((c) => ((c - 1 + d + 40) % 40) + 1); };
  stepRef.current = step;

  useEffect(() => {
    setKeepAliveInfo(String(ch), "wrist CB · monitoring");
  }, [ch]);

  useEffect(() => () => stopKeepAlive(), []);
  useEffect(() => prestageCadenceAudio(), []);

  const down = async () => {
    if (keyed) return;
    armKeepAlive();
    setKeyed(true);
    tapHaptic(20);
    chirp();
    if (!canRecord()) return;
    try {
      if (!micRef.current) micRef.current = await openMic();
      micRef.current.start();
      stopTimer.current = window.setTimeout(() => void up(), MAX_KEY_MS);
    } catch { /* mic refused: release still sends a text chirp */ }
  };

  const up = async () => {
    if (stopTimer.current) { clearTimeout(stopTimer.current); stopTimer.current = null; }
    setKeyed((k) => {
      if (!k) return k;
      void (async () => {
        const body = micRef.current ? await micRef.current.stop() : null;
        txRef.current?.(body ? { kind: "voice", from: callRef.current, body } : { kind: "text", from: callRef.current, body: "chirp chirp" });
        tailStatic();
      })();
      return false;
    });
  };

  useEffect(() => () => micRef.current?.close(), []);

  // Flip-flip: two hard wrist rotations within ~0.9s latch the key; flip-flip again sends.
  // Opt-in so the watch never wakes sensors it doesn't need.
  const [flip, setFlip] = useState(false);
  const [sensor, setSensor] = useState<"checking" | "gyro" | "motion" | "none">("checking");
  const levels = useLevels();
  const keyedRef = useRef(keyed);
  keyedRef.current = keyed;
  const actRef = useRef({ down, up });
  actRef.current = { down, up };
  useEffect(() => {
    if (!flip) return;
    let strokes: number[] = [];
    let lastStroke = 0;
    let cooldown = 0;
    let prev: number | null = null;
    let sawGyro = false;
    let sawAccel = false;
    const probe = window.setTimeout(() => {
      setSensor(sawGyro ? "gyro" : sawAccel ? "motion" : "none");
    }, 2000);
    const stroke = (now: number) => {
      lastStroke = now;
      strokes = strokes.filter((t) => now - t < 900).concat(now);
      if (strokes.length >= 2) {
        strokes = [];
        cooldown = now + 1200;
        if (keyedRef.current) void actRef.current.up();
        else void actRef.current.down();
      }
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const now = performance.now();
      const r = e.rotationRate;
      const rot = r ? Math.max(Math.abs(r.alpha ?? 0), Math.abs(r.beta ?? 0), Math.abs(r.gamma ?? 0)) : 0;
      if (rot > 0) sawGyro = true;
      const g = e.accelerationIncludingGravity;
      let jerk = 0;
      if (g && g.x !== null) {
        sawAccel = true;
        const m = Math.hypot(g.x ?? 0, g.y ?? 0, g.z ?? 0);
        jerk = prev === null ? 0 : Math.abs(m - prev);
        prev = m;
      }
      if (now < cooldown || now - lastStroke < 180) return;
      // Gyro if the watch has one; otherwise a hard snap on the accelerometer.
      if (sawGyro ? rot >= 280 : jerk >= 9) stroke(now);
    };
    window.addEventListener("devicemotion", onMotion);
    return () => { clearTimeout(probe); window.removeEventListener("devicemotion", onMotion); };
  }, [flip]);

  const toggleFlip = async () => {
    tapHaptic();
    if (flip) { setFlip(false); return; }
    setSensor("checking");
    const DM = (globalThis as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    if (!DM) { setSensor("none"); return; }
    if (typeof DM.requestPermission === "function") {
      try { if ((await DM.requestPermission()) !== "granted") return; } catch { return; }
    }
    setFlip(true);
  };

  const thick = "rounded-xl border-[3px] border-warn";

  return (
    <main className={`flex w-full select-none flex-col bg-background p-2 text-foreground ${embedded ? "h-full" : "h-app"}`} style={{ touchAction: "manipulation" }}>
      <header className="flex items-center justify-between">
        {embedded ? <span className="w-10" /> : <a href={CB_ROUTES.face} className={`${thick} px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-warn`}>Face</a>}
        <div className="text-center leading-none">
          <div className="text-[13px] font-black uppercase tracking-[0.2em] text-warn">Wrist Radio</div>
          <div className={`mt-0.5 text-[9px] font-bold uppercase tracking-widest ${state === "live" ? "text-signal" : "text-warn"}`}>
            {state === "live" ? "● on air" : state === "joining" ? "○ tuning" : "○ reconnecting"}
          </div>
        </div>
        {embedded ? <span className="w-10" /> : <a href={CB_ROUTES.radio} className={`${thick} px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-warn`}>Full</a>}
      </header>
      <div className={`mt-2 flex items-center justify-between gap-2 ${thick} bg-card p-2`}>
        <button type="button" onClick={() => step(-1)} className={`${thick} h-12 w-12 text-2xl font-black text-warn`} aria-label="Channel down">−</button>
        <div className="flex-1 text-center">
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">channel</div>
          <div className="cb-channel-digits text-warn" style={{ fontSize: 52, lineHeight: 1 }}>{String(ch).padStart(2, "0")}</div>
        </div>
        <button type="button" onClick={() => step(1)} className={`${thick} h-12 w-12 text-2xl font-black text-warn`} aria-label="Channel up">+</button>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <p className="flex-1 truncate text-[10px] font-bold uppercase tracking-widest text-signal">
          {last ? `${last.from} · ${last.kind === "voice" ? "voice" : last.body}` : "listening"}
        </p>

      </div>
      <button type="button" onClick={() => void toggleFlip()} className={`mt-1 w-full rounded-xl border-[3px] border-warn py-2 text-[13px] font-black uppercase tracking-widest ${flip ? "bg-warn text-background" : "text-warn"}`}>
        {flip ? "↻ flip talk on" : "↻ turn on flip talk"}
      </button>
      {flip ? (
        <p className={`mt-0.5 text-[9px] font-bold uppercase tracking-widest ${sensor === "none" ? "text-destructive" : "text-muted-foreground"}`}>
          {sensor === "checking" ? "checking sensors…" : sensor === "gyro" ? "gyro ok" : sensor === "motion" ? "motion only · snap hard" : "no motion sensor · use the button"}
        </p>
      ) : null}
      {/* communicator grille: flipped-open antenna look, static */}
      <div className="mt-2 flex items-center gap-2">
      <RadialKnob label="vol" value={levels.rx} max={RX_MAX} onChange={(v) => setLevel("rx", v)} size={40} />
      <div className={`flex-1 ${thick} bg-card px-3 py-2`} aria-hidden>
        <div className="flex flex-col gap-[5px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[3px] rounded-full bg-warn" style={{ opacity: 1 - i * 0.18 }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[8px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
          <span>apex</span><span>wrist</span><span>band</span>
        </div>
      </div>
      </div>
      <button
        type="button"
        onPointerDown={(e) => { e.preventDefault(); if (keyedRef.current) void up(); else void down(); }}
        style={{ touchAction: "none" }}
        onContextMenu={(e) => e.preventDefault()}
        className={`mt-2 flex-1 rounded-2xl border-4 text-xl font-black uppercase tracking-widest ${keyed ? "border-warn bg-warn text-background" : "border-warn bg-card text-warn"}`}
      >
        {keyed ? (flip ? "talking · tap or flip to send" : "talking · tap to send") : "tap to talk"}
      </button>
    </main>
  );
}
