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
 * One-tap PWA bundle install, with an honest path for panels that cannot
 * install at all.
 *
 * Watch browsers (Lokmat and similar Wear WebViews) never fire
 * `beforeinstallprompt`, show no install icon in the address bar and have no
 * desktop-mode switch — there is no hidden install route to point at. So when
 * the real dialog is unavailable we try handing the URL to Chrome, and if that
 * navigation does not happen we stop pretending and surface the download
 * routes instead of a dead button.
 */
export default function InstallButton({ className = "" }: { className?: string }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

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

  if (installed) return null;

  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(null), 5000);
  };

  const tap = async () => {
    const outcome = await runInstall();
    if (outcome) return;

    if (isIos()) {
      flash("ios: share ▸ add to home screen");
      return;
    }

    if (isAndroid()) {
      // Hand off to Chrome, which owns the installer on Android. On a watch
      // WebView the intent is simply ignored: nothing navigates, no error. So
      // we watch for the page still being here and then tell the truth.
      let left = false;
      const mark = () => {
        left = true;
      };
      document.addEventListener("visibilitychange", mark, { once: true });
      window.addEventListener("pagehide", mark, { once: true });
      try {
        window.location.href = chromeIntentUrl();
      } catch {
        /* watch WebViews throw on unknown schemes */
      }
      window.setTimeout(() => {
        document.removeEventListener("visibilitychange", mark);
        window.removeEventListener("pagehide", mark);
        if (!left && document.visibilityState === "visible") setBlocked(true);
      }, 1500);
      return;
    }

    setBlocked(true);
  };

  if (blocked) {
    return (
      <div
        className={`rounded-sm border border-warn/60 bg-background/80 p-1 text-[8px] uppercase tracking-widest text-warn ${className}`}
      >
        <p>this browser can&apos;t install</p>
        <p className="mt-0.5 normal-case tracking-normal opacity-80">
          No install prompt, no address-bar icon and no desktop mode on this panel — that&apos;s the
          watch browser, not the app. Keep using it straight from the web, or get the packaged build
          on a phone.
        </p>
        <a
          href="/downloads"
          className="mt-1 inline-block rounded-sm border border-signal/60 px-2 py-1 text-signal"
        >
          download routes
        </a>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void tap()}
        aria-label="Install app bundle"
        className={`rounded-sm border py-1 text-[8px] uppercase tracking-widest active:bg-accent ${
          ready
            ? "border-signal bg-signal/15 text-signal"
            : "border-signal/60 bg-background/70 text-signal"
        } ${className}`}
      >
        bundle
      </button>
      {note ? (
        <p
          role="status"
          className="pointer-events-none fixed inset-x-2 bottom-10 z-[9998] rounded-sm border border-signal/50 bg-background/95 px-2 py-1 text-center text-[8px] uppercase tracking-widest text-signal"
        >
          {note}
        </p>
      ) : null}
    </>
  );
}
