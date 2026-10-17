import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { collectDeviceProfile, downscaleImage, SYMPTOMS, type DeviceProfile } from "@/lib/watch-report";
import { diagnoseWatchReport, type WatchDiagnosis } from "@/lib/watch-report.functions";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Watch Tester Report — Apex Signal";
const DESCRIPTION =
  "Send a screen recording and your watch details from the watch itself. Apex reads the panel and tells you whether the blackout is sizing, rendering or the screen timeout.";

export const Route = createFileRoute("/watch-report")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WatchReportPage,
});

const CAUSE_LABEL: Record<string, string> = {
  sizing: "Sizing — the page is being measured wrong",
  rendering: "Rendering — the panel cannot hold the picture",
  "display-sleep": "Screen timeout — the watch is putting the display to sleep",
  "script-crash": "Script fault — the page tears itself down after painting",
  network: "Network — the page never finishes loading",
  unclear: "Not yet clear — more evidence needed",
};

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right text-signal">{v}</span>
    </div>
  );
}

function WatchReportPage() {
  const run = useServerFn(diagnoseWatchReport);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [model, setModel] = useState("");
  const [os, setOs] = useState("");
  const [browser, setBrowser] = useState("");
  const [symptom, setSymptom] = useState<string>(SYMPTOMS[0].label);
  const [works, setWorks] = useState("");
  const [notes, setNotes] = useState("");
  const [frames, setFrames] = useState<string[]>([]);
  const [recording, setRecording] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WatchDiagnosis | null>(null);

  useEffect(() => {
    setProfile(collectDeviceProfile());
    const onResize = () => setProfile(collectDeviceProfile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const addFrames = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    try {
      const shots: string[] = [];
      for (const file of Array.from(files).slice(0, 3 - frames.length)) {
        shots.push(await downscaleImage(file));
      }
      setFrames((f) => [...f, ...shots].slice(0, 3));
    } catch {
      setError("That picture could not be read on this device.");
    }
  };

  const uploadRecording = async (file: File | null | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) {
      setUploading(false);
      setError("Sign in to attach a recording. The rest of the report still works.");
      return;
    }
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("watch-evidence").upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
    setUploading(false);
    if (upErr) {
      setError("The recording could not be sent. The rest of the report still works.");
      return;
    }
    setRecording(path);
  };

  const submit = async () => {
    if (!profile) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const diagnosis = await run({
        data: {
          watchModel: model.trim() || null,
          osVersion: os.trim() || null,
          browser: browser.trim() || null,
          symptom,
          pagesThatWork: works.trim() || null,
          notes: notes.trim() || null,
          recordingPath: recording,
          frames,
          profile: profile as unknown as Record<string, unknown>,
        },
      });
      setResult(diagnosis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The report could not be read right now.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "mt-1 w-full rounded-md border border-border bg-background/70 px-2 py-2 text-xs text-foreground outline-none focus:border-signal";
  const label = "text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground";

  return (
    <main className="no-scrollbar min-h-app overflow-y-auto px-3 py-5 text-foreground">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <header>
          <p className="text-[10px] uppercase tracking-[0.3em] text-scan">Watch testers</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-signal">Report a black screen</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Open this page on the watch itself. It reads the panel automatically. Add a recording and
            a few words, and you get back the most likely reason the screen goes black.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-card/50 p-3">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-scan">
            What this watch reports
          </h2>
          {profile ? (
            <div className="mt-2 space-y-0.5 text-[11px]">
              <Row k="Panel" v={`${profile.screen.w}x${profile.screen.h} at ${profile.screen.dpr}x`} />
              <Row k="Visible area" v={`${profile.viewport.innerW}x${profile.viewport.innerH}`} />
              <Row k="Page height in use" v={profile.appHeight} />
              <Row k="Form factor" v={profile.deviceBucket} />
              <Row k="Android" v={profile.androidVersion ? String(profile.androidVersion) : "unknown"} />
              <Row k="Browser engine" v={profile.chromeVersion ? `Chrome ${profile.chromeVersion}` : "unknown"} />
              <Row k="Can hold the screen awake" v={profile.wakeLockSupported ? "yes" : "no"} />
              <Row k="Accelerated graphics" v={profile.webglSupported ? "yes" : "no"} />
              <Row k="Installed as an app" v={profile.standalone ? "yes" : "no"} />
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">Reading the panel…</p>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card/50 p-3">
          <div>
            <span className={label}>What happens</span>
            <select value={symptom} onChange={(e) => setSymptom(e.target.value)} className={field}>
              {SYMPTOMS.map((s) => (
                <option key={s.id} value={s.label}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className={label}>Watch model</span>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Lokmat LEM T" className={field} />
            </div>
            <div>
              <span className={label}>Android version</span>
              <input value={os} onChange={(e) => setOs(e.target.value)} placeholder="10" className={field} />
            </div>
            <div>
              <span className={label}>Opened in</span>
              <input value={browser} onChange={(e) => setBrowser(e.target.value)} placeholder="Chrome / installed app" className={field} />
            </div>
          </div>

          <div>
            <span className={label}>Pages that paint and stay on this watch</span>
            <input
              value={works}
              onChange={(e) => setWorks(e.target.value)}
              placeholder="Tremor mesh map, sign-in screen"
              className={field}
            />
          </div>

          <div>
            <span className={label}>What you saw</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="It paints for about a second, then the whole screen goes black. Touching it does nothing."
              className={field}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={label}>Screen photos or frames (up to 3)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void addFrames(e.target.files)}
                className={field}
              />
              {frames.length ? (
                <div className="mt-2 flex gap-2">
                  {frames.map((f, i) => (
                    <img key={i} src={f} alt={`Frame ${i + 1}`} className="h-12 rounded border border-border" />
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <span className={label}>Screen recording</span>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => void uploadRecording(e.target.files?.[0])}
                className={field}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {uploading ? "Sending…" : recording ? "Recording received." : "Optional, up to 50 MB."}
              </p>
            </div>
          </div>

          <button
            onClick={() => void submit()}
            disabled={busy || !profile}
            className="w-full rounded-full border border-signal/60 bg-signal/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-signal disabled:opacity-40"
          >
            {busy ? "Reading the report…" : "Send report and get a verdict"}
          </button>
          {error ? <p className="text-[11px] text-alert">{error}</p> : null}
        </section>

        {result ? (
          <section className="rounded-lg border border-signal/50 bg-card/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-scan">Most likely cause</p>
            <h2 className="mt-1 text-sm font-bold text-signal">
              {CAUSE_LABEL[result.primaryCause] ?? result.primaryCause}
            </h2>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              Confidence: {result.confidence}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-foreground">{result.summary}</p>

            {result.evidence.length ? (
              <>
                <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-scan">
                  What points to it
                </h3>
                <ul className="mt-1 space-y-1">
                  {result.evidence.map((e) => (
                    <li key={e} className="flex gap-2 text-[11px] text-muted-foreground">
                      <span className="text-scan">·</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {result.fixes.length ? (
              <>
                <h3 className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-scan">
                  What would fix it
                </h3>
                <ul className="mt-1 space-y-1">
                  {result.fixes.map((f) => (
                    <li key={f} className="flex gap-2 text-[11px] text-muted-foreground">
                      <span className="text-signal">→</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <p className="mt-3 rounded border border-border bg-background/60 p-2 text-[11px] text-foreground">
              Next test: {result.testerNextStep}
            </p>
          </section>
        ) : null}

        <p className="pb-6 text-[10px] text-muted-foreground">
          Nothing about your location or accounts is read.{" "}
          <Link to="/diag" className="text-scan underline">
            Full device diagnostics
          </Link>
        </p>
      </div>
    </main>
  );
}
