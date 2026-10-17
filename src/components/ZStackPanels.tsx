import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import type { AppSkin } from "@/lib/skins";
import { Button } from "@/components/ui/button";

/**
 * Z Stack slide panels — the skin engine's skeleton. One component renders
 * every app's drawers: left/right slide-overs plus a bottom slide-up, with
 * translucent breathing edge tabs and the LED under-light. The skin picks
 * the accent and what lives in each drawer; the behavior is identical
 * everywhere. First visit shows the hint bubble so people find the gesture.
 */
export type ZPanelLink = { to: string; label: string };

type Side = "left" | "right" | "up";

export function ZStackPanels({
  skin,
  leftExtra,
  rightExtra,
  upExtra,
}: {
  skin: AppSkin;
  leftExtra?: ReactNode;
  rightExtra?: ReactNode;
  upExtra?: ReactNode;
}) {
  const [open, setOpen] = useState<Side | null>(null);
  const [hint, setHint] = useState(false);
  const [shelf, setShelf] = useState<1 | 2>(2);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!localStorage.getItem(skin.hintKey)) {
        setHint(true);
        t = setTimeout(() => setHint(false), 6000);
        localStorage.setItem(skin.hintKey, "1");
      }
    } catch {
      /* storage unavailable */
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [skin.hintKey]);

  const sheet = (side: Side) => {
    const cfg = side === "left" ? skin.left : side === "right" ? skin.right : skin.up;
    const extra = side === "left" ? leftExtra : side === "right" ? rightExtra : upExtra;
    const pos =
      side === "left"
        ? "z-sheet-left border-r-2 inset-y-0 left-0 w-[min(82%,340px)] flex-col"
        : side === "right"
          ? "z-sheet-right border-l-2 inset-y-0 right-0 w-[min(82%,340px)] flex-col"
          : `z-sheet-up border-t-2 inset-x-0 bottom-0 ${shelf === 1 ? "h-[34dvh]" : "h-[67dvh]"} flex-col`;
    return (
      <aside
        className={`z-sheet ${pos} fixed z-50 flex border-warn bg-background/95 p-3 text-[14px] uppercase`}
        aria-label={cfg.title}
      >
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="tracking-[0.2em] text-signal">{cfg.title}</span>
          {side === "up" && (
            <button type="button" onClick={() => setShelf(shelf === 1 ? 2 : 1)} className="ml-auto mr-2 border border-border px-2 text-[11px] text-muted-foreground" aria-label={shelf === 1 ? "Raise map to two thirds" : "Lower map to one third"}>
              {shelf === 1 ? "⅓ ˄" : "⅔ ˅"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="px-2 text-[20px] leading-none text-muted-foreground"
            aria-label={`Close ${cfg.title}`}
          >
            {side === "up" ? "ˇ" : side === "left" ? "‹" : "›"}
          </button>
        </div>
        {side === "up" && <div className="z-shelf-seam" aria-hidden="true" />}
        <nav className="mt-2 flex shrink-0 flex-col gap-1 overflow-y-auto">
          {cfg.links.map((l) => (
            <Link
              key={`${l.to}-${l.label}`}
              to={l.to}
              onClick={() => { const question = l.question; if (question) window.setTimeout(() => window.dispatchEvent(new CustomEvent("apex:mystic-question", { detail: question })), 0); setOpen(null); }}
              className="border border-border bg-card/50 px-2 py-1 text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {extra && <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-border pt-2">{extra}</div>}
      </aside>
    );
  };

  return (
    <div className={`skin-${skin.id} contents`}>
      {hint && !open && (
        <div
          role="status"
          className="fixed left-1/2 top-3 z-[60] -translate-x-1/2 rounded-full border border-warn bg-background/95 px-4 py-1.5 text-[12px] font-bold uppercase tracking-widest text-warn"
        >
          Edge tabs slide out — {skin.left.label} left, {skin.right.label} right, {skin.up.label} below
        </div>
      )}
      {open && (
        <Button
          type="button"
          onClick={() => setOpen(null)}
          aria-label="Snap all drawers shut"
          className="app-snap fixed bottom-3 left-1/2 z-[60] h-5 -translate-x-1/2 border border-warn bg-background/40 px-2 py-0 text-[10px] font-bold uppercase text-signal"
        >
          Snap shut
        </Button>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen("left")}
          aria-label={`Open ${skin.left.title}`}
          className="z-tab z-tab-left fixed left-0 top-1/2 z-40 -translate-y-1/2"
        >
          <span className="z-tab-chev" aria-hidden="true">›</span>
          <span className="z-tab-label">{skin.left.label}</span>
        </button>
      )}
      {open === "left" && sheet("left")}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen("right")}
          aria-label={`Open ${skin.right.title}`}
          className="z-tab z-tab-right fixed right-0 top-1/2 z-40 -translate-y-1/2"
        >
          <span className="z-tab-chev" aria-hidden="true">‹</span>
          <span className="z-tab-label">{skin.right.label}</span>
        </button>
      )}
      {open === "right" && sheet("right")}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen("up")}
          aria-label={`Open ${skin.up.title}`}
          className="z-tab z-tab-up fixed bottom-0 left-1/2 z-40 -translate-x-1/2"
        >
          <span className="z-tab-chev" aria-hidden="true">˄</span>
          <span className="z-tab-label-x">{skin.up.label}</span>
        </button>
      )}
      {open === "up" && sheet("up")}
    </div>
  );
}
