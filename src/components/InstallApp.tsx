import { useEffect, useState } from "react";
import {
  chromeIntentUrl,
  getInstallPrompt,
  isAndroid,
  isIos,
  isStandalone,
  onInstallPromptChange,
  runInstall,
} from "@/lib/install-prompt";

/**
 * Primary delivery CTA: the installable web app is what ships today, so this
 * is the first thing offered anywhere the product is sold. Native wrappers are
 * secondary. Falls back to a Chrome hand-off on Android WebViews and an iOS
 * share-sheet hint where the browser owns the install gesture.
 */
export default function InstallApp({ className = "" }: { className?: string }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setReady(!!getInstallPrompt());
    setInstalled(isStandalone());
    const off = onInstallPromptChange((e) => setReady(!!e));
    const done = () => setInstalled(true);
    window.addEventListener("appinstalled", done);
    return () => {
      off();
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(null), 5000);
  };

  const tap = async () => {
    const outcome = await runInstall();
    if (outcome === "accepted" || outcome === "dismissed") return;
    if (isIos()) {
      flash("iOS: tap Share, then “Add to Home Screen”.");
      return;
    }
    if (isAndroid()) {
      window.location.href = chromeIntentUrl();
      flash("Opening Chrome to finish the install…");
      return;
    }
    flash("Use your browser’s install icon in the address bar to add the app.");
  };

  if (installed) {
    return (
      <p className={`text-[11px] uppercase tracking-[0.2em] text-signal ${className}`}>
        App installed
      </p>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void tap()}
        className="rounded-sm bg-signal px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-background hover:opacity-90"
      >
        {ready ? "Install the app" : "Install the app"}
      </button>
      {note ? (
        <p role="status" className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          {note}
        </p>
      ) : null}
    </div>
  );
}
