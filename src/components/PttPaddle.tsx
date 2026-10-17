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
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { bindPttKey } from "@/lib/ptt-key";

/** Under this, a press counts as a tap and latches the mic open. */
const TAP_MS = 250;
const RELEASE_GRACE_MS = 280;

export type PaddleState = "idle" | "keyed" | "blocked";

type Props = {
  /** open the mic; resolves false when it could not be opened */
  onOpen: () => Promise<boolean> | boolean;
  /** close the mic and transmit */
  onSend: () => void | Promise<void>;
  keyed: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  /** seconds remaining before the automatic cut-off */
  remaining?: number;
};

export function PttPaddle({
  onOpen,
  onSend,
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
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const down = useRef(false);
  const resumed = useRef(false);

  const cancelRelease = () => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
  };

  useEffect(() => () => cancelRelease(), []);

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

  const send = useCallback(async () => {
    cancelRelease();
    if (opening.current) await opening.current;
    setLatched(false);
    await onSend();
  }, [onSend]);

  /* hardware side key — always hold-to-talk */
  useEffect(() => {
    if (disabled) return;
    return bindPttKey(
      () => {
        cancelRelease();
        setHint("side key");
        void open();
      },
      () => { cancelRelease(); releaseTimer.current = setTimeout(() => void send(), RELEASE_GRACE_MS); },
    );
  }, [disabled, open, send]);

  const pointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    down.current = true;
    resumed.current = !!releaseTimer.current;
    if (releaseTimer.current) { cancelRelease(); downAt.current = Date.now(); return; }
    downAt.current = Date.now();
    if (latched) return; // second tap: handled on release
    void open();
  };

  const pointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!down.current) return;
    down.current = false;
    const held = Date.now() - downAt.current;
    if (latched) return void send(); // second tap sends
    if (held < TAP_MS && !resumed.current) {
      // If permission takes longer than the tap, wait until recording is live.
      void open().then((ok) => { if (ok) { setLatched(true); setHint("mic open — tap again to send"); } });
      return;
    }
    resumed.current = false;
    cancelRelease();
    releaseTimer.current = setTimeout(() => { if (!down.current) void send(); }, RELEASE_GRACE_MS);
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
        onPointerCancel={() => { down.current = false; if (keyed && !latched) { cancelRelease(); releaseTimer.current = setTimeout(() => void send(), RELEASE_GRACE_MS); } }}
        onContextMenu={(e) => e.preventDefault()}
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
