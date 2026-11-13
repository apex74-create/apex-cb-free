/**
 * The talk paddle.
 *
 * Three ways to key up, all landing in the same place:
 *   hold      — press and hold, release to send (classic radio)
 *   tap       — one tap opens the mic, a second tap sends (gloves, cold)
 *   side key  — the hardware PTT button on a rugged handset
 *
 * Android is kept out of the way: no long-press share sheet, no text
 * selection, no context menu, no drag. Pointer capture means sliding a
 * thumb off the paddle still releases cleanly instead of sticking on air.
 * A hold of any length on this paddle is just a hold — context menu,
 * selection start and lost-capture are all swallowed below, so nothing
 * the browser or Android offers can interrupt a transmission (Nov 7,
 * 2026: the web half of the PTT chooser fix; the native half lives in
 * MainActivity, which consumes the hardware key at dispatch level).
 *
 * The paddle forwards raw press/release edges and nothing more. All
 * release timing — the grace window that forgives a thumb-slip and
 * decides what counts as a send — lives in the PTT session machine
 * (lib/ptt-session.ts), the single owner of the session. A second,
 * private grace here is how the states used to fork (Nov 12, 2026).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { bindPttKey } from "@/lib/ptt-key";

/** Under this, a press counts as a tap and latches the mic open. */
const TAP_MS = 250;

export type PaddleState = "idle" | "keyed" | "blocked";

type Props = {
  /** press edge: open the session; resolves false when it could not open */
  onOpen: () => Promise<boolean> | boolean;
  /** release edge: hands the release to the session's grace window */
  onSend: () => void | Promise<void>;
  /** deliberate ending (tap-mode second tap): close the session now */
  onFinish?: () => void | Promise<void>;
  keyed: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  /** seconds remaining before the automatic cut-off */
  remaining?: number;
};

export function PttPaddle({
  onOpen,
  onSend,
  onFinish,
  keyed,
  disabled = false,
  disabledLabel = "mic unavailable",
  remaining,
}: Props) {
  const [latched, setLatched] = useState(false);
  const [hint, setHint] = useState<string>("");
  const downAt = useRef(0);
  const busy = useRef(false);
  const opening = useRef<Promise<boolean> | null>(null);
  const down = useRef(false);

  const open = useCallback(async () => {
    if (opening.current) return opening.current;
    if (busy.current || disabled) return false;
    busy.current = true;
    const pending = Promise.resolve().then(onOpen).then((ok) => {
      if (!ok) setHint("mic did not open");
      return ok;
    }).catch(() => { setHint("mic did not open"); return false; }).finally(() => { busy.current = false; opening.current = null; });
    opening.current = pending;
    return pending;
  }, [disabled, onOpen]);

  /* Release edge: the session machine's grace window takes it from
   * here — a re-press inside the window resumes the same session. */
  const send = useCallback(async () => {
    if (opening.current) await opening.current;
    setLatched(false);
    await onSend();
  }, [onSend]);

  /* Deliberate ending: tap-mode's second tap closes the session now. */
  const finishSend = useCallback(async () => {
    if (opening.current) await opening.current;
    setLatched(false);
    await (onFinish ? onFinish() : onSend());
  }, [onFinish, onSend]);

  /* hardware side key — always hold-to-talk */
  useEffect(() => {
    if (disabled) return;
    return bindPttKey(
      () => {
        setHint("side key");
        void open();
      },
      () => { void send(); },
    );
  }, [disabled, open, send]);

  const pointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    down.current = true;
    downAt.current = Date.now();
    if (latched) return; // second tap: handled on release
    void open();
  };

  const pointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!down.current) return;
    down.current = false;
    const held = Date.now() - downAt.current;
    if (latched) return void finishSend(); // second tap sends, now
    if (held < TAP_MS) {
      // If permission takes longer than the tap, wait until recording is live.
      void open().then((ok) => { if (ok) { setLatched(true); setHint("mic open — tap again to send"); } });
      return;
    }
    void send();
  };

  const label = disabled
    ? disabledLabel
    : keyed
      ? latched
        ? "◉ on air — tap to send"
        : "◉ on air — release to send"
      : "hold to talk  ·  or tap once";

  return (
    <div className="mb-1 select-none">
      <button
        type="button"
        disabled={disabled}
        draggable={false}
        onPointerDown={pointerDown}
        onPointerUp={pointerUp}
        onPointerCancel={() => { down.current = false; if (keyed && !latched) void send(); }}
        onLostPointerCapture={() => { if (down.current) { down.current = false; if (keyed && !latched) void send(); } }}
        onContextMenu={(e) => e.preventDefault()}
        onSelectStart={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{ touchAction: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
        aria-pressed={keyed}
        aria-label="push to talk"
        className={`w-full rounded-md border px-2 py-3 text-[18px] font-bold uppercase transition-colors ${
          keyed
            ? "border-alert bg-alert/25 text-alert"
            : "border-signal/60 bg-signal/15 text-signal active:bg-signal/25"
        } ${disabled ? "opacity-40" : ""}`}
      >
        {label}
      </button>
      <p className="mt-0.5 text-center text-[12px] uppercase text-muted-foreground">
        {keyed && remaining !== undefined
          ? `${remaining}s left`
          : hint || "hold · tap · or the side key on a rugged handset"}
      </p>
    </div>
  );
}
