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

  const open = useCallback(async () => {
    if (busy.current || disabled) return false;
    busy.current = true;
    const ok = await onOpen();
    busy.current = false;
    if (!ok) setHint("mic did not open");
    return ok;
  }, [disabled, onOpen]);

  const send = useCallback(async () => {
    setLatched(false);
    await onSend();
  }, [onSend]);

  /* hardware side key — always hold-to-talk */
  useEffect(() => {
    if (disabled) return;
    return bindPttKey(
      () => {
        setHint("side key");
        void open();
      },
      () => void send(),
    );
  }, [disabled, open, send]);

  const pointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    downAt.current = Date.now();
    if (latched) return; // second tap: handled on release
    void open();
  };

  const pointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const held = Date.now() - downAt.current;
    if (latched) return void send(); // second tap sends
    if (held < TAP_MS && keyed) {
      // Quick tap: stay on air until the next tap.
      setLatched(true);
      setHint("mic open — tap again to send");
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
    <div className="mb-2 select-none">
      <button
        type="button"
        disabled={disabled}
        draggable={false}
        onPointerDown={pointerDown}
        onPointerUp={pointerUp}
        onPointerCancel={() => keyed && !latched && void send()}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{ touchAction: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
        aria-pressed={keyed}
        aria-label="push to talk"
        className={`w-full rounded-md border py-8 text-[26px] font-bold uppercase tracking-[0.25em] transition-colors ${
          keyed
            ? "border-alert bg-alert/25 text-alert"
            : "border-signal/60 bg-card/60 text-signal active:bg-signal/15"
        } ${disabled ? "opacity-40" : ""}`}
      >
        {label}
      </button>
      <p className="mt-1 text-center text-[16px] uppercase tracking-wider text-muted-foreground">
        {keyed && remaining !== undefined
          ? `${remaining}s left`
          : hint || "hold · tap · or the side key on a rugged handset"}
      </p>
    </div>
  );
}
