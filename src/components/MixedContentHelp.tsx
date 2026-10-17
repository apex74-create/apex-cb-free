import { useState } from "react";

const STEPS: { title: string; lines: string[] }[] = [
  {
    title: "Start the licensed agent in Termux",
    lines: [
      "Install Termux from its official release. Open the private operator bundle in Termux; keep termux-setup.sh beside adb-bridge-agent.mjs.",
      "Run: bash termux-setup.sh",
      "Check: curl http://127.0.0.1:8787/health — adb_present should be true. This checks the agent, not the browser link.",
      "Keep your token from ~/apex-agent/token private. Termux:Boot is optional; the installer only writes its hook.",
    ],
  },
  {
    title: "Choose a reachable connection",
    lines: [
      "The published HTTPS app needs a trusted wss:// address. A plain Termux ws:// address cannot connect to it, even when /health succeeds.",
      "Use a TLS certificate trusted by your phone/browser on the agent, or a trusted encrypted tunnel with access controls. Never expose the agent without its token.",
      "For local HTTP development only, ws://<phone LAN IP>:8787/adb works when both devices can reach each other.",
    ],
  },
  {
    title: "Finish in Bridge settings",
    lines: [
      "Enter the agent host, port 8787, /adb and the saved token; tap Test handshake, then Commit + dial.",
      "A successful handshake only confirms the agent. Pair Android Wireless debugging once, then enter its CONNECT address (not the pairing port).",
      "The status must read online with an authorized ADB device before PCAP controls work. Bruce/PCAPdroid are separate installations.",
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
        {open ? "Hide setup steps" : "Set up the bridge agent"}
      </button>
      {open ? (
        <ul className="mt-1 space-y-1.5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-sm border border-border p-1.5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-signal">
                {i + 1}. {step.title}
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
