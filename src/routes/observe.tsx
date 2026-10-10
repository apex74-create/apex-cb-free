import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  OBS_BLOCKS,
  TRENDS,
  isAllowed,
  markSaved,
  readLocal,
  recordLocal,
  toGrid,
  verdictFor,
  type FieldObservation,
  type Trend,
} from "@/lib/field-observations";

const TITLE = "Ground Check — Field Observations | Apex Signal";
const DESCRIPTION =
  "Log frost, fog, wind and crop conditions. Your reports are stored for a documented weather study; they do not automatically change the forecast.";

export const Route = createFileRoute("/observe")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ObservePage,
});

const VERDICT: Record<number, string> = {
  6: "6 · ground confirms the report",
  3: "3 · ground contradicts the report",
  9: "9 · changing — holding for the next frames",
};

const AGES = [0, 5, 15, 25, 45, 60];

function ObservePage() {
  const [blockId, setBlockId] = useState<FieldObservation["block"]>("wind");
  const block = OBS_BLOCKS.find((b) => b.id === blockId) ?? OBS_BLOCKS[0]!;
  const [reported, setReported] = useState<string | null>(null);
  const [observed, setObserved] = useState<string | null>(null);
  const [trend, setTrend] = useState<Trend>("same");
  const [age, setAge] = useState<number | null>(null);
  const [observedAt, setObservedAt] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<FieldObservation[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => setHistory(readLocal()), []);

  const pick = (id: typeof blockId) => { setBlockId(id); setReported(null); setObserved(null); };

  const submit = async () => {
    if (!reported || !observed || !isAllowed(blockId, reported, observed)) return;
    const obs: FieldObservation = {
      id: crypto.randomUUID(), block: blockId, reported, observed, trend, reportAgeMin: age,
      verdict: verdictFor(reported, observed, trend), at: observedAt ? new Date(observedAt).getTime() : Date.now(),
      ...(note.trim() ? { note: note.trim() } : {}), sync: "pending",
    };
    if (!Number.isFinite(obs.at) || obs.at > Date.now() + 60000) { setStatus("Choose a valid observation time, not a future time."); return; }
    setHistory(recordLocal(obs));
    setReported(null); setObserved(null); setTrend("same");
    setNote(""); setObservedAt("");

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setStatus(`${VERDICT[obs.verdict]} · saved on this device (sign in to add it to the study)`); return; }
    const pos = await new Promise<GeolocationPosition | null>((res) =>
      navigator.geolocation ? navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 4000 }) : res(null),
    );
    const { error } = await supabase.from("field_observations").insert({
      user_id: auth.user.id, block: obs.block, reported: obs.reported, observed: obs.observed,
      trend: obs.trend, verdict: obs.verdict, report_age_min: obs.reportAgeMin,
      lat_grid: pos ? toGrid(pos.coords.latitude) : null, lon_grid: pos ? toGrid(pos.coords.longitude) : null,
      client_id: obs.id ?? null, observed_at: new Date(obs.at).toISOString(), note: obs.note ?? null,
    });
    if (!error && obs.id) setHistory(markSaved(obs.id));
    setStatus(error ? `${VERDICT[obs.verdict]} · saved here, study upload failed` : `${VERDICT[obs.verdict]} · added to the study`);
  };

  const chip = (on: boolean): "default" | "outline" => (on ? "default" : "outline");

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <header>
        <h1 className="text-2xl font-bold">Ground check</h1>
        <p className="text-sm text-muted-foreground">Your eyes are the sensor. Compare the report with what you saw, day or night.</p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist">
        {OBS_BLOCKS.map((b) => (
          <Button key={b.id} role="tab" aria-selected={b.id === blockId} size="sm" variant={chip(b.id === blockId)} onClick={() => pick(b.id)}>{b.label}</Button>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <p className="font-medium">{block.question}</p>
        <div>
          <p className="mb-1 text-xs uppercase text-muted-foreground">The report says</p>
          <div className="flex flex-wrap gap-2">{block.choices.map((c) => <Button key={c} size="sm" variant={chip(reported === c)} onClick={() => setReported(c)}>{c}</Button>)}</div>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase text-muted-foreground">Report age (minutes)</p>
          <div className="flex flex-wrap gap-2">{AGES.map((a) => <Button key={a} size="sm" variant={chip(age === a)} onClick={() => setAge(a)}>{a === 60 ? "60+" : a}</Button>)}</div>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase text-muted-foreground">I actually see</p>
          <div className="flex flex-wrap gap-2">{block.choices.map((c) => <Button key={c} size="sm" variant={chip(observed === c)} onClick={() => setObserved(c)}>{c}</Button>)}</div>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase text-muted-foreground">A minute ago it was</p>
          <div className="flex flex-wrap gap-2">{TRENDS.map((t) => <Button key={t.id} size="sm" variant={chip(trend === t.id)} onClick={() => setTrend(t.id)}>{t.label}</Button>)}</div>
        </div>
        <label className="block text-xs uppercase text-muted-foreground">When did you see it? (leave blank for now)
          <input type="datetime-local" value={observedAt} max={new Date().toISOString().slice(0, 16)} onChange={(e) => setObservedAt(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2 text-sm text-foreground" />
        </label>
        <label className="block text-xs uppercase text-muted-foreground">Field note (optional; evidence only, not model input)
          <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. three days of rain flattened the plants" className="mt-1 block min-h-16 w-full rounded border bg-background p-2 text-sm text-foreground" />
        </label>
        <Button className="w-full" disabled={!reported || !observed} onClick={submit}>Send ground check</Button>
        {status ? <p role="status" className="text-sm text-warn">{status}</p> : null}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Your recent checks</h2>
        {history.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
          <ul className="space-y-1 text-sm">
            {history.slice(0, 12).map((h) => (
              <li key={h.at} className="flex justify-between gap-2 border-b py-1">
                <span>{h.block}: report {h.reported} → saw {h.observed} · {new Date(h.at).toLocaleString()} · {h.sync === "saved" ? "study saved" : "device only"}{h.note ? ` · ${h.note}` : ""}</span>
                <span className="font-mono text-warn">|{h.verdict}⟩</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-muted-foreground">Study records are private to your account. A failed upload remains on this device; it is not yet in the study. Ground checks are evidence for review, not automatic algorithm training or a forecast correction.</p>
      <Link to="/forecast" className="text-sm underline">Back to forecast</Link>
    </main>
  );
}
