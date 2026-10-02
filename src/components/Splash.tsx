import { useEffect, useState } from "react";

const LINES = [
  "apex signal · watch build",
  "face: probing shape",
  "radio: 802.11 / ble / rf",
  "bridge: pc → phone → relay",
  "ready",
];

export default function Splash({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= LINES.length) {
      const t = setTimeout(onDone, 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 320 : 240);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="Skip intro"
      className="scan-grid fixed inset-0 z-50 grid place-items-center bg-background text-left"
    >
      <div className="face-pad w-full">
        <div className="mx-auto grid w-full max-w-[15rem] gap-2">
          <div className="grid justify-items-center gap-1">
            <span className="splash-ring grid h-12 w-12 place-items-center rounded-full border border-signal/60 text-lg text-signal">
              ◈
            </span>
            <h1 className="text-[11px] font-bold uppercase tracking-[0.3em] text-signal">
              Apex Signal
            </h1>
          </div>
          <ul className="grid gap-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
            {LINES.map((line, i) => (
              <li
                key={line}
                className={`truncate transition-opacity duration-200 ${
                  i < step ? "opacity-100" : "opacity-0"
                } ${i === LINES.length - 1 && i < step ? "text-signal" : ""}`}
              >
                <span className="text-signal/70">›</span> {line}
              </li>
            ))}
          </ul>
          <span className="text-center text-[7px] uppercase tracking-widest text-muted-foreground/60">
            tap to skip
          </span>
        </div>
      </div>
    </button>
  );
}
