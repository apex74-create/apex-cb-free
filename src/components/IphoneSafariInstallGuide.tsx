import { Apple, PlusSquare, Share, Smartphone } from "lucide-react";

/** A generic fruit-and-phone cue, not Apple's trademark or an App Store badge. */
export default function IphoneSafariInstallGuide() {
  return (
    <section aria-labelledby="iphone-install-title" className="border-t border-border bg-surface/40 px-3 py-2 text-[10px] sm:px-4">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="relative flex h-6 w-6 shrink-0 items-center justify-center border border-scan/50 text-scan">
          <Smartphone size={15} strokeWidth={1.6} />
          <Apple size={10} strokeWidth={1.8} className="absolute -right-1 -top-1 bg-surface text-warn" />
        </span>
        <div className="min-w-0">
          <h2 id="iphone-install-title" className="text-[11px] font-bold text-foreground">iPhone · add to Home Screen</h2>
        </div>
      </div>
      <ol className="mt-2 grid gap-1 leading-relaxed text-muted-foreground sm:grid-cols-3">
        <li className="flex items-start gap-1"><span className="font-bold text-scan">1.</span><span>Open this site in Safari.</span></li>
        <li className="flex items-start gap-1"><span className="font-bold text-scan">2.</span><span>Tap Share <Share aria-label="Share icon" size={12} className="inline align-text-bottom text-scan" />, then “Add to Home Screen” <PlusSquare aria-label="Add to Home Screen icon" size={12} className="inline align-text-bottom text-scan" />.</span></li>
        <li className="flex items-start gap-1"><span className="font-bold text-scan">3.</span><span>Tap Add; open it from your Home Screen.</span></li>
      </ol>
      <p className="mt-1 text-[9px] text-muted-foreground">Generic apple symbol. Not affiliated with Apple.</p>
    </section>
  );
}