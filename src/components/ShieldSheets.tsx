import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  cachedTileCount,
  clearRegionCache,
  detectRegion,
  precacheRegion,
  regionLabel,
  type PrecacheProgress,
  type TileRegion,
} from "@/lib/offline-tiles";

type Instrument = "defense" | "tremor" | "bruce";
const NOTE_KEY = "apex.shield.notes.local.v1";

function downloadExtension() {
  fetch("/apex-shield-extension.zip")
    .then((res) => {
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "apex-shield-extension.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch((err) => alert(err.message));
}

export function ShieldReferences() {
  return <div className="space-y-3 text-xs normal-case text-muted-foreground">
    <p>Separate instruments · separate sources</p>
    <p className="border border-border p-2"><span className="text-signal">Works with, not part of Apex:</span> Bruce is free, open-source firmware from a separate project that you flash onto your own CYD board yourself. Apex doesn't make, ship or support Bruce, and the Bruce project isn't affiliated with Apex. The Shield only reads the text your device prints over USB.</p>
    <p className="border-b border-border pb-2 text-signal">PCAP feed: our own intake only — no legacy server calls.</p>
    <p>HTTP: POST JSON packets to /api/public/shield-pcap with header x-shield-token set to your relay token.</p>
    <p>TCP dump: in your capture app (e.g. PCAPdroid — the free version already does this; the paid upgrade is an in-app donation), set the TCP dump receiver to the local forwarder's address. The forwarder posts the same JSON to the intake above.</p>
    <p>File dump: point the capture app's file dump at a watched folder; the forwarder reads new files and posts them the same way. Both paths are read-only — the Shield never sends input or control back to the capture device.</p>
    <p>Bruce CYD terminal: the sandbox display terminal is intentionally read-only — it shows what the board prints over USB with no input-output control.</p>
    <p>GPS trail: measured device fixes. Estimated location and Wi-Fi observations carry their own source labels. Bruce: local serial text only.</p>
    <div className="border-t border-border pt-2">
      <p className="text-signal">Chrome companion (Zapback line)</p>
      <p>Toolbar companion that watches console reachability and opens the Shield. No account data leaves your browser.</p>
      <Button type="button" variant="outline" size="sm" onClick={downloadExtension}>Download extension zip</Button>
      <p className="text-muted-foreground">Install: unzip → chrome://extensions → Developer mode → Load unpacked → pick the folder.</p>
    </div>
    <OfflineRegionCache />
  </div>;
}

function OfflineRegionCache() {
  const [region, setRegion] = useState<TileRegion>("us");
  const [cached, setCached] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PrecacheProgress | null>(null);

  useEffect(() => {
    setRegion(detectRegion());
    void cachedTileCount().then(setCached);
  }, []);

  const run = async () => {
    setBusy(true);
    const result = await precacheRegion(region, setProgress);
    setProgress(result);
    setCached(await cachedTileCount());
    setBusy(false);
  };

  const clear = async () => {
    await clearRegionCache();
    setCached(0);
    setProgress(null);
  };

  return (
    <div className="border-t border-border pt-2">
      <p className="text-signal">Offline map — your region only</p>
      <p>Caches the light street map for one region at wide zooms (about 120 tiles, ~5–10 MB). No worldwide dump, no satellite imagery. The map opens offline; live feeds still need a network.</p>
      <div className="flex items-center gap-2">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as TileRegion)}
          disabled={busy}
          className="border border-border bg-background p-1 text-foreground"
          aria-label="Region to cache"
        >
          <option value="us">United States</option>
          <option value="europe">Europe</option>
        </select>
        <Button type="button" variant="outline" size="sm" onClick={run} disabled={busy}>
          {busy ? "Caching…" : `Cache ${regionLabel(region)}`}
        </Button>
        {cached > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={busy}>
            Clear
          </Button>
        )}
      </div>
      <p className="text-muted-foreground" role="status">
        {busy && progress
          ? `Caching ${progress.done}/${progress.total}${progress.failed ? ` · ${progress.failed} skipped` : ""}`
          : cached > 0
            ? `${cached} tiles stored on this device`
            : "Nothing cached yet"}
      </p>
    </div>
  );
}

export function ShieldWork() {
  const [tab, setTab] = useState<"notes" | "scripts">("notes");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { try { setNote(localStorage.getItem(NOTE_KEY) ?? ""); } catch { /* private storage unavailable */ } }, []);
  const save = () => {
    try { localStorage.setItem(NOTE_KEY, note); setSaved(true); } catch { setSaved(false); }
  };
  return <div className="flex min-h-0 flex-1 flex-col gap-3 text-xs normal-case">
    <div role="tablist" aria-label="Shield work sheets" className="flex border-b border-border">
      {(["notes", "scripts"] as const).map((item) => <Button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} variant={tab === item ? "default" : "ghost"} size="sm" className="flex-1 uppercase">{item}</Button>)}
    </div>
    {tab === "notes" ? <>
      <label htmlFor="shield-notes" className="text-muted-foreground">Private notes on this device</label>
      <textarea id="shield-notes" maxLength={10000} value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} className="min-h-48 flex-1 resize-none border border-border bg-card p-2 text-foreground" placeholder="Record what you actually observed…" />
      <Button type="button" onClick={save} size="sm">Save locally</Button>
      <span role="status" className="text-muted-foreground">{saved ? "Saved on this device" : "Not synced or uploaded"}</span>
    </> : <div className="space-y-3 text-muted-foreground">
      <p>Hosted scripts are not available in this preview.</p>
      <p>Separately licensed reference material will appear here after review and a verified purchase flow. Protected engine operations run behind authenticated calls; source scripts never download to the browser.</p>
      <p>No payment or script access is active.</p>
    </div>}
  </div>;
}

export function ShieldMaps({ active, onSelect }: { active: Instrument; onSelect: (view: Instrument) => void }) {
  return <div className="grid gap-2 text-xs normal-case sm:grid-cols-3">
    {([
      ["tremor", "Tremor map engine", "GPS motion intensity; no CYD connection"],
      ["defense", "Defense ops · mesh map", "Live dots from real CYD/PCAP readings"],
      ["bruce", "Defense ops · Bruce CYD", "Read-only serial; connected tier"],
    ] as const).map(([view, title, sub]) => <Button key={view} type="button" variant={active === view ? "default" : "outline"} className="h-auto min-h-16 flex-col items-start whitespace-normal p-3 text-left" onClick={() => onSelect(view)} aria-pressed={active === view}><strong>{title}</strong><small className="text-muted-foreground">{sub}</small></Button>)}
  </div>;
}
