import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/cloud";
import { getSafeUseStatus, acceptSafeUse, SAFE_USE_POLICY_VERSION } from "@/lib/safe-use.functions";

export const Route = createFileRoute("/radiolab")({
  head: () => ({
    meta: [
      { title: "RadioLab Comms Pack — Apex Signal" },
      {
        name: "description",
        content:
          "RadioLab Comms Pack for Network Engineers: passive RF survey, channel density mapping and WiGLE-compatible logging behind a dated safe-use attestation.",
      },
      { property: "og:title", content: "RadioLab Comms Pack for Network Engineers" },
      {
        property: "og:description",
        content:
          "Passive RF survey and site-audit tooling for licensed network engineers. Sign-in and dated safe-use attestation required.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RadioLabScreen,
});

const POLICY = [
  "I am a network engineer, wireless auditor or researcher, and I will use this pack only on networks I own or have written permission to test.",
  "I will keep this pack passive: observe, measure and log. I will not transmit deauthentication, jamming or spoofed frames with it.",
  "I will follow local law, including FCC Part 15 for unlicensed digital links and Part 95 for CB. I will not transmit encrypted audio on CB.",
  "I will store and share survey logs responsibly, and I will not publish credentials or personally identifying capture data.",
  "I accept that offensive tooling (Marauder, Bruce payloads and similar) is never included in a store build and is my own responsibility if I attach it.",
];

function RadioLabScreen() {
  const { session, loading } = useSession();
  const status = useServerFn(getSafeUseStatus);
  const accept = useServerFn(acceptSafeUse);
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setAccepted(null);
      return;
    }
    let live = true;
    void status()
      .then((r) => live && setAccepted(r.accepted))
      .catch(() => live && setAccepted(false));
    return () => {
      live = false;
    };
  }, [session, status]);

  async function onAccept() {
    setBusy(true);
    setError(null);
    try {
      await accept({ data: { confirm: true } });
      setAccepted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the attestation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-lg font-bold uppercase tracking-widest text-signal">
        RadioLab Comms Pack
      </h1>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        For network engineers · policy version {SAFE_USE_POLICY_VERSION}
      </p>

      <p className="mt-4 text-sm text-foreground">
        Passive RF survey, channel and BSSID density mapping, and WiGLE-compatible logging. Nothing
        in this pack transmits into a network. Access is recorded against your account.
      </p>

      {loading ? (
        <p className="mt-6 text-xs text-muted-foreground">Checking your account…</p>
      ) : !session ? (
        <div className="mt-6 rounded-sm border border-warn/60 p-4">
          <p className="text-sm">Sign in first. Access to this pack is tied to an account.</p>
          <Link
            to="/auth"
            className="mt-3 inline-block rounded-sm border border-signal/60 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-signal hover:bg-signal/10"
          >
            Sign in
          </Link>
        </div>
      ) : accepted === null ? (
        <p className="mt-6 text-xs text-muted-foreground">Checking your attestation…</p>
      ) : accepted ? (
        <div className="mt-6 space-y-3">
          <p className="rounded-sm border border-signal/60 p-3 text-sm text-signal">
            Safe-use policy accepted. The RadioLab workspace is unlocked on this account.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/map"
              className="rounded-sm border border-border px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:border-scan hover:text-scan"
            >
              Survey map
            </Link>
            <Link
              to="/diag"
              className="rounded-sm border border-border px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:border-scan hover:text-scan"
            >
              Signal readouts
            </Link>
            <Link
              to="/cb"
              className="rounded-sm border border-border px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:border-scan hover:text-scan"
            >
              Comms deck
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-sm border border-warn/60 p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-warn">
            Safe-use attestation
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {POLICY.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-warn">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1"
            />
            <span>I have read and accept the terms above, dated {SAFE_USE_POLICY_VERSION}.</span>
          </label>
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          <button
            type="button"
            disabled={!checked || busy}
            onClick={() => void onAccept()}
            className="mt-4 rounded-sm border-2 border-warn px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-warn disabled:opacity-40"
          >
            {busy ? "Recording…" : "Accept and unlock"}
          </button>
        </div>
      )}
    </main>
  );
}
