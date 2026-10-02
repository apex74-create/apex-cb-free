import { useState } from "react";
import AgentBuilder from "@/components/AgentBuilder";
import BridgeDoctor from "@/components/BridgeDoctor";
import BridgeProfiles from "@/components/BridgeProfiles";
import DiscoveryScan from "@/components/DiscoveryScan";
import MixedContentHelp from "@/components/MixedContentHelp";
import { usePhoneLanIp } from "@/lib/lan-ip";
import {
  KIND_LABEL,
  saveEndpoints,
  saveTarget,
  toSecureUrl,
  type BridgeEndpoint,
  type LinkState,
} from "@/lib/bridge";

/** Editable failover chain: PC agent, phone agent, cloud relay. */
export default function BridgeSettings({
  endpoints,
  target,
  onTargetChange,
  onPair,
  onConnect,
  onFind,
  activeId,
  state = "idle",
  diagnosis = null,
  onChange,
  onClose,
}: {
  endpoints: BridgeEndpoint[];
  target: string;
  onTargetChange: (next: string) => void;
  onPair: (target: string, code: string) => Promise<string>;
  onConnect: (target?: string) => Promise<string>;
  onFind?: () => Promise<string>;
  activeId: string | null;
  state?: LinkState;
  diagnosis?: string | null;
  onChange: (next: BridgeEndpoint[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<BridgeEndpoint[]>(endpoints);
  const [targetDraft, setTargetDraft] = useState(target);
  const [pairTarget, setPairTarget] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  // Detected automatically off the live link so the LAN address never has to
  // be typed in by hand.
  const { iface: lanIface } = usePhoneLanIp(20000);

  const update = (id: string, patch: Partial<BridgeEndpoint>) =>
    setDraft((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const commit = () => {
    saveTarget(targetDraft);
    onTargetChange(targetDraft);
    saveEndpoints(draft);
    onChange(draft);
    onClose();
  };

  return (
    <div className="no-scrollbar absolute inset-0 z-20 overflow-y-auto bg-background/97 face-pad py-2">
      <MixedContentHelp />

      <BridgeDoctor
        endpoints={draft}
        target={targetDraft}
        activeId={activeId}
        state={state}
        diagnosis={diagnosis}
      />

      <BridgeProfiles
        endpoints={draft}
        target={targetDraft}
        onLoad={(nextEndpoints, nextTarget) => {
          setDraft(nextEndpoints);
          setTargetDraft(nextTarget);
          onChange(nextEndpoints);
          onTargetChange(nextTarget);
          setStatus("profile loaded — save + dial to connect");
        }}
      />

      <AgentBuilder
        endpoints={draft}
        target={targetDraft}
        onCommit={async (id, url, token) => {
          const next = draft.map((e) =>
            e.id === id ? { ...e, url, enabled: true, ...(token ? { token } : {}) } : e,
          );
          setDraft(next);
          saveTarget(targetDraft);
          onTargetChange(targetDraft);
          saveEndpoints(next);
          onChange(next);
          setBusy(true);
          try {
            const msg = await onConnect(targetDraft);
            setStatus(msg);
            return msg;
          } catch (error) {
            const msg = error instanceof Error ? error.message : "connect failed";
            setStatus(msg);
            return msg;
          } finally {
            setBusy(false);
          }
        }}
      />

      <DiscoveryScan
        endpoints={draft}
        target={targetDraft}
        onAssign={(id, url) => {
          update(id, { url, enabled: true });
          setStatus(`assigned ${url}`);
        }}
      />

      <p className="pb-1 text-[8px] uppercase tracking-widest text-muted-foreground">
        Phone adb address (host:port)
      </p>
      <input
        value={targetDraft}
        onChange={(e) => setTargetDraft(e.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        inputMode="url"
        placeholder="connect IP:port shown by Android"
        aria-label="Phone adb address"
        className="mb-1 w-full rounded-sm border border-border bg-card px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal"
      />
      {lanIface ? (
        <button
          type="button"
          onClick={() => {
            const port = targetDraft.split(":")[1] ?? "5555";
            setTargetDraft(`${lanIface.ip}:${port}`);
            setStatus(`detected ${lanIface.name} ${lanIface.ip}`);
          }}
          className="mb-1 w-full truncate rounded-sm border border-scan py-1 text-[8px] uppercase tracking-widest text-scan"
        >
          use detected {lanIface.name} · {lanIface.ip}
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy || !targetDraft.trim()}
        onClick={async () => {
          setBusy(true);
          setStatus("connecting…");
          try {
            saveTarget(targetDraft);
            onTargetChange(targetDraft);
            setStatus(await onConnect(targetDraft));
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "connect failed");
          } finally {
            setBusy(false);
          }
        }}
        className="mb-1 w-full rounded-sm border border-signal py-1 text-[8px] uppercase tracking-widest text-signal disabled:opacity-40"
      >
        connect adb · not pair port
      </button>
      {onFind ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setStatus("searching for the phone…");
            try {
              setStatus(await onFind());
            } catch (error) {
              setStatus(error instanceof Error ? error.message : "no device found");
            } finally {
              setBusy(false);
            }
          }}
          className="mb-3 w-full rounded-sm border border-scan py-1 text-[8px] uppercase tracking-widest text-scan disabled:opacity-40"
        >
          port changed? find phone automatically
        </button>
      ) : null}

      <p className="pb-1 text-[8px] uppercase tracking-widest text-muted-foreground">
        Pair new phone — one time
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-1">
        <input
          value={pairTarget}
          onChange={(e) => setPairTarget(e.target.value)}
          placeholder="pairing IP:port"
          aria-label="Wireless debugging pairing address"
          className="w-full rounded-sm border border-border bg-card px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal"
        />
        <input
          value={pairCode}
          onChange={(e) => setPairCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          aria-label="Six digit wireless debugging pairing code"
          className="w-full rounded-sm border border-border bg-card px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal"
        />
      </div>
      <button
        type="button"
        disabled={busy || !pairTarget.trim() || pairCode.length !== 6}
        onClick={async () => {
          setBusy(true);
          setStatus("pairing…");
          try {
            setStatus(await onPair(pairTarget, pairCode));
            setPairCode("");
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "pairing failed");
          } finally {
            setBusy(false);
          }
        }}
        className="mt-1 mb-1 w-full rounded-sm border border-border py-1 text-[8px] uppercase tracking-widest text-muted-foreground disabled:opacity-40"
      >
        pair with code
      </button>
      {status ? (
        <p className="mb-3 break-words text-[8px] leading-snug text-warn">{status}</p>
      ) : null}

      <p className="pb-2 text-[8px] uppercase tracking-widest text-muted-foreground">
        Failover order — top first
      </p>

      <ul className="space-y-2">
        {draft.map((endpoint, i) => (
          <li key={endpoint.id} className="rounded-sm border border-border p-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <span className="min-w-0 truncate text-[9px] font-bold uppercase tracking-widest text-signal">
                {i + 1}. {KIND_LABEL[endpoint.kind]}
                {activeId === endpoint.id ? " ●" : ""}
              </span>
              <button
                type="button"
                onClick={() => update(endpoint.id, { enabled: !endpoint.enabled })}
                className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
              >
                {endpoint.enabled ? "on" : "off"}
              </button>
            </div>
            <input
              value={endpoint.url}
              onChange={(e) => update(endpoint.id, { url: e.target.value })}
              spellCheck={false}
              autoCapitalize="none"
              inputMode="url"
              aria-label={`${endpoint.label} socket URL`}
              className="mt-1.5 w-full rounded-sm border border-border bg-card px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal"
            />
            {typeof window !== "undefined" &&
            window.location.protocol === "https:" &&
            endpoint.url.startsWith("ws://") ? (
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[7px] uppercase text-alert">blocked on HTTPS · needs wss://</p>
                <button
                  type="button"
                  onClick={() =>
                    update(endpoint.id, { url: toSecureUrl(endpoint.url), enabled: true })
                  }
                  className="shrink-0 rounded-sm border border-signal px-1.5 py-0.5 text-[7px] uppercase tracking-widest text-signal active:bg-accent"
                >
                  use wss://
                </button>
              </div>
            ) : null}

            <input
              value={endpoint.token ?? ""}
              onChange={(e) => update(endpoint.id, { token: e.target.value })}
              placeholder="token (optional)"
              spellCheck={false}
              autoCapitalize="none"
              aria-label={`${endpoint.label} token`}
              className="mt-1 w-full rounded-sm border border-border bg-card px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal"
            />
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2 pb-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-border py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground active:text-signal"
        >
          cancel
        </button>
        <button
          type="button"
          onClick={commit}
          className="rounded-sm border border-signal py-1.5 text-[9px] uppercase tracking-widest text-signal active:bg-accent"
        >
          save + dial
        </button>
      </div>
    </div>
  );
}
