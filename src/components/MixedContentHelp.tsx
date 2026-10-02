import { useState } from "react";

const STEPS: { title: string; tag: string; lines: string[] }[] = [
  {
    tag: "recommended",
    title: "Host the dash locally",
    lines: [
      "cd wifi-bridge",
      "npm install && npm start",
      "open apex-dash/index.html (file://) or serve on http://localhost:3000",
      "local http pages are exempt from mixed-content blocking",
    ],
  },
  {
    tag: "quickest",
    title: "Allow insecure content for this site",
    lines: [
      "tap the padlock in the address bar",
      "site settings → insecure content",
      "switch block (default) → allow",
      "reload — https page may now dial ws://",
    ],
  },
  {
    tag: "production",
    title: "ngrok secure tunnel",
    lines: [
      "ngrok http 8787",
      "copy the wss://<id>.ngrok.app URL",
      "paste it into the relay endpoint above",
    ],
  },
];

/** On-device crib sheet for getting ws:// agents reachable from an HTTPS page. */
export default function MixedContentHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-sm border border-warn py-1 text-[8px] uppercase tracking-widest text-warn"
      >
        {open ? "hide" : "mixed content blocked? bypass protocols"}
      </button>
      {open ? (
        <ul className="mt-1 space-y-1.5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-sm border border-border p-1.5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-signal">
                {i + 1}. {step.title}
              </p>
              <p className="text-[7px] uppercase tracking-widest text-muted-foreground">
                {step.tag}
              </p>
              <ul className="mt-1 space-y-0.5">
                {step.lines.map((line) => (
                  <li key={line} className="break-words text-[8px] leading-snug text-foreground">
                    · {line}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
