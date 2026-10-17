/**
 * Command Deck — a Z Stack sheet. Copy-to-clipboard only; the browser never
 * runs commands. Operator cards show launch lines (never script bodies) and
 * render only for operator tier. Personal notes/snippets stay on-device and
 * are never sent over any link or radio.
 */
import { useEffect, useState } from "react";
import { fetchCloudTier } from "@/lib/cloud";

type Entry = { id: string; kind: "note" | "snippet"; text: string; channel?: string; when?: string };
const KEY = "apex.cb.command-deck";

const OPERATOR_CARDS = [
  { label: "Termux setup", cmd: "bash agent/termux-setup.sh" },
  { label: "Assembly install", cmd: "bash agent/assembly-install.sh" },
  { label: "Deploy to watch", cmd: "bash agent/watch-deploy.sh" },
  { label: "Start bridge agent", cmd: "node agent/adb-bridge-agent.mjs" },
  { label: "Tristar proxy", cmd: "python3 agent/tristar_proxy.py" },
  { label: "Net chat", cmd: "python3 agent/reticulum/netchat.py" },
  { label: "ADB OTG check", cmd: "adb devices -l\nadb shell getprop ro.product.model" },
];

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}

export function CommandDeck({ onClose, status }: { onClose: () => void; status: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [operator, setOperator] = useState(false);
  const [kind, setKind] = useState<Entry["kind"]>("note");
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("");
  const [when, setWhen] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    try { setEntries(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* empty */ }
    fetchCloudTier().then((t) => setOperator(t === "operator")).catch(() => {});
  }, []);
  const save = (next: Entry[]) => { setEntries(next); localStorage.setItem(KEY, JSON.stringify(next)); };
  const doCopy = async (id: string, t: string) => { if (await copy(t)) { setCopied(id); setTimeout(() => setCopied(null), 1200); } };

  const add = () => {
    const body = text.trim();
    if (!body) return;
    const e: Entry = { id: crypto.randomUUID(), kind, text: body.slice(0, 2000) };
    if (kind === "note" && channel.trim()) e.channel = channel.trim().slice(0, 12);
    if (kind === "note" && when) e.when = when;
    save([e, ...entries]); setText(""); setChannel(""); setWhen("");
  };

  return (
    <aside className="z-sheet z-sheet-right absolute inset-y-0 right-0 z-50 flex w-[min(88%,380px)] flex-col border-l-2 border-warn bg-background/95 p-3 text-[14px]" aria-label="Command deck">
      <div className="flex items-center justify-between border-b border-border pb-2 uppercase">
        <button type="button" onClick={onClose} className="px-2 text-[20px] leading-none text-muted-foreground" aria-label="Close command deck">›</button>
        <span className="tracking-[0.2em] text-signal">Command Deck</span>
      </div>
      <p className="mt-2 text-[12px] uppercase text-muted-foreground">Status: {status}</p>
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {operator && OPERATOR_CARDS.map((c) => (
          <div key={c.label} className="border border-warn/60 bg-card/50 p-2">
            <div className="flex items-center justify-between uppercase"><span className="text-foreground">{c.label}</span>
              <button type="button" onClick={() => doCopy(c.label, c.cmd)} className="border border-border px-2 text-[12px] text-signal">{copied === c.label ? "Copied" : "Copy"}</button></div>
            <pre className="mt-1 whitespace-pre-wrap text-[12px] text-muted-foreground">{c.cmd}</pre>
          </div>
        ))}
        <div className="border border-border p-2">
          <div className="flex gap-1 uppercase text-[12px]">
            {(["note", "snippet"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`flex-1 border px-2 py-1 ${kind === k ? "border-warn text-signal" : "border-border text-muted-foreground"}`}>{k === "note" ? "Field note" : "My snippet"}</button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder={kind === "note" ? "Talk to Ray about the antenna…" : "Paste a command you use often"} className="mt-2 w-full border border-border bg-background p-2 text-foreground" />
          {kind === "note" && (
            <div className="mt-1 flex gap-1">
              <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Channel" className="w-20 border border-border bg-background p-1 text-foreground" aria-label="Meet-up channel" />
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="min-w-0 flex-1 border border-border bg-background p-1 text-foreground" aria-label="Meet-up time" />
            </div>
          )}
          <button type="button" onClick={add} className="mt-2 w-full border border-warn py-1 uppercase text-signal">Save</button>
        </div>
        {entries.map((e) => (
          <div key={e.id} className="border border-border bg-card/50 p-2">
            <div className="flex items-center justify-between text-[12px] uppercase text-muted-foreground">
              <span>{e.kind === "note" ? "Note" : "Snippet"}{e.channel ? ` · ch ${e.channel}` : ""}{e.when ? ` · ${new Date(e.when).toLocaleString()}` : ""}</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => doCopy(e.id, e.text)} className="text-signal">{copied === e.id ? "Copied" : "Copy"}</button>
                <button type="button" onClick={() => save(entries.filter((x) => x.id !== e.id))} aria-label="Delete">✕</button>
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{e.text}</p>
          </div>
        ))}
        {!operator && entries.length === 0 && <p className="text-[12px] text-muted-foreground">Empty deck. Licensed operator scripts appear here automatically.</p>}
      </div>
      <p className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">Stays on this device. Never transmitted.</p>
    </aside>
  );
}
