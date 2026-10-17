import { createFileRoute, Link } from "@tanstack/react-router";
import AppTopBar from "@/components/AppTopBar";
import { useCallback, useEffect, useRef, useState } from "react";
import { BridgeGate } from "@/components/BridgeGate";
import { useBridge } from "@/lib/bridge-context";
import {
  CMD,
  INBOX,
  isDestHash,
  loadPeers,
  parseIdentity,
  parseInbox,
  parsePaths,
  parseStatus,
  readSpool,
  savePeers,
  sendCmd,
  type Iface,
  type InboxMsg,
  type Path,
  type Peer,
} from "@/lib/reticulum";
import {
  balance,
  credit,
  envelope,
  getKeys,
  loadChain,
  mint,
  verifyChain,
  walletAddress,
  type TokenEntry,
} from "@/lib/token";
import {
  CB_MAX,
  CB_MIN,
  header,
  loadActive,
  loadChannels,
  makeChannel,
  passesSquelch,
  readHeader,
  saveActive,
  saveChannels,
  textPrefix,
  type Channel,
} from "@/lib/channels";
import {
  AIRPLANE,
  CELL_STATE,
  MODES,
  applyCmd,
  isOffgridIface,
  spec,
  towerDown,
  type OffgridMode,
} from "@/lib/offgrid";

export const Route = createFileRoute("/netchat")({
  head: () => ({
    meta: [
      { title: "Netchat — Reticulum Mesh Controller" },
      {
        name: "description",
        content:
          "Watch-side controller for a Reticulum mesh node on Android: LXMF netchat, interface and path tables, and a sovereign signed chat-token ledger.",
      },
      { property: "og:title", content: "Netchat — Reticulum Mesh Controller" },
      {
        property: "og:description",
        content:
          "Send LXMF messages over Reticulum from a smartwatch, paid with a locally signed sovereign chat token.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NetchatView,
});

const FEE = 1;

function NetchatView() {
  const { state, run } = useBridge();
  const [tab, setTab] = useState<"chat" | "mesh" | "fm" | "token">("chat");
  const [chans, setChans] = useState<Channel[]>([]);
  const [active, setActive] = useState(19);
  const [ifaces, setIfaces] = useState<Iface[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [identity, setIdentity] = useState<string | null>(null);
  const [nodeUp, setNodeUp] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<InboxMsg[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [dest, setDest] = useState("");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [addr, setAddr] = useState("");
  const [chain, setChain] = useState<TokenEntry[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const creditedRef = useRef<Set<string>>(new Set());
  const [ogMode, setOgMode] = useState<OffgridMode>("hotspot");
  const [tower, setTower] = useState<boolean | null>(null);

  const offline = state !== "online";

  useEffect(() => {
    setPeers(loadPeers());
    setChans(loadChannels());
    setActive(loadActive());
    void (async () => {
      const { pubHex } = await getKeys();
      setAddr(await walletAddress(pubHex));
      let c = loadChain();
      if (c.length === 0) {
        await mint(10); // sovereign bootstrap float, signed like every other entry
        c = loadChain();
      }
      setChain(c);
      setChainOk((await verifyChain(c)).ok);
    })();
  }, []);

  const refreshToken = useCallback(async () => {
    const c = loadChain();
    setChain(c);
    setChainOk((await verifyChain(c)).ok);
  }, []);

  const poll = useCallback(async () => {
    if (offline) return;
    try {
      const [alive, inbox] = await Promise.all([
        run(CMD.rnsdAlive).catch(() => "0"),
        run(CMD.inbox).catch(() => ""),
      ]);
      setNodeUp(Number(alive.trim().split(/\s+/)[0] ?? 0) > 0);
      const parsed = parseInbox(inbox);
      setMsgs(parsed.slice(-40).reverse());
      // Credit inbound token envelopes exactly once each.
      for (const m of parsed) {
        const env = m.token as { entry?: { hash?: string }; fee?: number } | undefined;
        const h = env?.entry?.hash;
        if (h && !creditedRef.current.has(h)) {
          creditedRef.current.add(h);
          await credit(Number(env?.fee ?? FEE), m.from);
        }
      }
      await refreshToken();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "poll failed");
    }
  }, [offline, run, refreshToken]);

  useEffect(() => {
    void poll();
    const t = setInterval(() => void poll(), 6000);
    return () => clearInterval(t);
  }, [poll]);

  const loadMesh = useCallback(async () => {
    if (offline) return;
    setBusy(true);
    try {
      await run(CMD.status());
      await run(CMD.paths());
      await run(CMD.identity());
      await new Promise((r) => setTimeout(r, 1200)); // termux writes the spool asynchronously
      const [st, pt, id] = await Promise.all([
        run(readSpool("rnstatus")).catch(() => ""),
        run(readSpool("rnpath")).catch(() => ""),
        run(readSpool("ident")).catch(() => ""),
      ]);
      setIfaces(parseStatus(st));
      setPaths(parsePaths(pt));
      setIdentity(parseIdentity(id));
      setNote(st.trim() ? "mesh read ok" : "no rnstatus output — is rnsd running?");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "mesh read failed");
    } finally {
      setBusy(false);
    }
  }, [offline, run]);

  /** Read the real radio state so "no tower" is verified, never assumed. */
  const readTower = useCallback(async () => {
    if (offline) return;
    try {
      const [ap, svc] = await Promise.all([
        run(AIRPLANE).catch(() => ""),
        run(CELL_STATE).catch(() => ""),
      ]);
      setTower(towerDown(ap, svc));
    } catch {
      setTower(null);
    }
  }, [offline, run]);

  const applyOffgrid = async () => {
    setBusy(true);
    try {
      await run(applyCmd(ogMode), 20000);
      setNote(`${spec(ogMode).label} config written · rnsd restarting`);
      await new Promise((r) => setTimeout(r, 2500));
      await loadMesh();
      await readTower();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "offgrid apply failed");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const to = dest.trim();
    if (!isDestHash(to)) return setNote("destination must be 32 hex chars");
    if (!text.trim()) return setNote("nothing to send");
    if (balance(chain) < FEE) return setNote("insufficient chat token");
    setBusy(true);
    try {
      const env = await envelope(text.trim(), to, FEE);
      await run(sendCmd(to, JSON.stringify(env)), 20000);
      setText("");
      setNote(`sent · ${FEE} token spent`);
      await refreshToken();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "send failed");
    } finally {
      setBusy(false);
    }
  };

  const chan = chans.find((c) => c.n === active) ?? makeChannel(active);

  const putChan = (next: Channel) => {
    const list = [...chans.filter((c) => c.n !== next.n), next].sort((a, b) => a.n - b.n);
    setChans(list);
    saveChannels(list);
  };

  const tune = (n: number) => {
    const wrapped = n < CB_MIN ? CB_MAX : n > CB_MAX ? CB_MIN : n;
    setActive(wrapped);
    saveActive(wrapped);
    if (!chans.some((c) => c.n === wrapped)) putChan(makeChannel(wrapped));
  };

  /** PTT: one keyed transmission fanned out to every roster member. */
  const broadcast = async (mode: "ptt" | "msg") => {
    const body = text.trim();
    if (!body) return setNote("nothing to transmit");
    if (chan.members.length === 0) return setNote("roster empty — add peers to this channel");
    const cost = FEE * chan.members.length;
    if (balance(chain) < cost)
      return setNote(`need ${cost} token for ${chan.members.length} stations`);
    setBusy(true);
    let ok = 0;
    try {
      const h = header(chan, mode);
      for (const to of chan.members) {
        try {
          const env = await envelope(textPrefix(chan, body), to, FEE);
          await run(sendCmd(to, JSON.stringify({ ...env, ch: h })), 20000);
          ok += 1;
        } catch {
          /* keep keying the rest of the net */
        }
      }
      setText("");
      setNote(`${chan.tag} ${mode} · ${ok}/${chan.members.length} stations · ${ok * FEE}c`);
      await refreshToken();
    } finally {
      setBusy(false);
    }
  };

  const chanMsgs = msgs.filter((m) => passesSquelch(chan, readHeader(m.token, m.content)));

  const savePeer = () => {
    const to = dest.trim();
    if (!isDestHash(to)) return setNote("destination must be 32 hex chars");
    const next = [...peers.filter((p) => p.hash !== to), { name: to.slice(0, 6), hash: to }];
    setPeers(next);
    savePeers(next);
    setNote("peer saved");
  };

  return (
    <main className="relative flex h-app w-full flex-col overflow-hidden bg-background">
      <AppTopBar title="Netchat · RNS" backTo="/app" storageKey="netchat">
        <button
          type="button"
          onClick={() =>
            setTab((t) =>
              t === "chat" ? "mesh" : t === "mesh" ? "fm" : t === "fm" ? "token" : "chat",
            )
          }
          className="app-hbtn h-8 shrink-0 rounded-sm px-1.5 text-[11px] uppercase tracking-widest text-signal"
        >
          {tab === "chat" ? "mesh" : tab === "mesh" ? "fm" : tab === "fm" ? "token" : "chat"}
        </button>
      </AppTopBar>

      <div className="z-10 shrink-0 border-b border-border face-pad py-1">
        <span
          className={`block truncate text-[9px] uppercase tracking-widest ${
            offline ? "text-alert" : nodeUp ? "text-signal" : "text-warn"
          }`}
        >
          {offline ? "○ no bridge" : nodeUp ? "● rnsd up" : "○ rnsd down"}
          {" · "}
          {balance(chain)} token
        </span>
        <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
          {identity ? `id ${identity.slice(0, 12)}…` : "identity unknown"} · wallet {addr || "…"}
        </span>
      </div>

      {tab === "chat" ? (
        <div className="min-h-0 flex-1 overflow-y-auto face-pad py-2">
          <BridgeGate what="Reticulum chat and FM/CB broadcast" mesh />
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="lxmf destination hash"
            spellCheck={false}
            autoCapitalize="none"
            maxLength={32}
            className="w-full rounded-sm border border-border bg-card/70 px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal/60"
          />
          {peers.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {peers.map((p) => (
                <button
                  key={p.hash}
                  type="button"
                  onClick={() => setDest(p.hash)}
                  className="rounded-sm border border-border px-1 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            placeholder="message"
            rows={2}
            className="mt-1 w-full resize-none rounded-sm border border-border bg-card/70 px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal/60"
          />
          <div className="mt-1 grid grid-cols-3 gap-1">
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void send()}
              className="rounded-sm border border-signal/50 py-1.5 text-[9px] uppercase tracking-widest text-signal active:bg-accent disabled:opacity-40"
            >
              send {FEE}c
            </button>
            <button
              type="button"
              onClick={savePeer}
              className="rounded-sm border border-border py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground active:bg-accent"
            >
              save peer
            </button>
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void poll()}
              className="rounded-sm border border-border py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground active:bg-accent disabled:opacity-40"
            >
              sync
            </button>
          </div>
          <p className="mt-1.5 break-words text-[8px] uppercase tracking-wider text-muted-foreground">
            {note || `inbox ${INBOX}`}
          </p>
          <ul className="mt-2 space-y-1">
            {msgs.length === 0 ? (
              <li className="text-[9px] uppercase tracking-widest text-muted-foreground">
                no source · empty inbox
              </li>
            ) : (
              msgs.map((m, i) => (
                <li
                  key={`${m.ts}-${i}`}
                  className="rounded-sm border border-border bg-card/70 px-1.5 py-1"
                >
                  <span className="block truncate text-[8px] uppercase tracking-widest text-scan">
                    {m.from.slice(0, 12)} · {new Date(m.ts).toLocaleTimeString()}
                    {m.token ? " · paid" : ""}
                  </span>
                  <span className="block break-words text-[9px] text-foreground">{m.content}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : tab === "mesh" ? (
        <div className="min-h-0 flex-1 overflow-y-auto face-pad py-2">
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void loadMesh()}
              className="rounded-sm border border-signal/50 py-1.5 text-[9px] uppercase tracking-widest text-signal active:bg-accent disabled:opacity-40"
            >
              read
            </button>
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void run(CMD.startNode()).then(() => setNote("rnsd start requested"))}
              className="rounded-sm border border-border py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground active:bg-accent disabled:opacity-40"
            >
              rnsd
            </button>
            <button
              type="button"
              disabled={offline || busy}
              onClick={() =>
                void run(CMD.startListener())
                  .then(() => run(CMD.announce()))
                  .then(() => setNote("listener + announce requested"))
              }
              className="rounded-sm border border-border py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground active:bg-accent disabled:opacity-40"
            >
              listen
            </button>
          </div>

          <div className="mt-3 rounded-sm border border-warn/50 bg-card/70 p-1.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[8px] uppercase tracking-widest text-warn">no tower</h2>
              <button
                type="button"
                disabled={offline || busy}
                onClick={() => void readTower()}
                className="text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal disabled:opacity-40"
              >
                {tower === null ? "check" : tower ? "cell radio off" : "cell radio up"}
              </button>
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {MODES.map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => setOgMode(m.mode)}
                  className={`rounded-sm border py-1 text-[8px] uppercase tracking-widest ${
                    ogMode === m.mode
                      ? "border-signal text-signal"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[8px] leading-snug text-muted-foreground">
              {spec(ogMode).carrier} · {spec(ogMode).range}
            </p>
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void applyOffgrid()}
              className="mt-1 w-full rounded-sm border border-warn/60 py-1.5 text-[9px] uppercase tracking-widest text-warn active:bg-accent disabled:opacity-40"
            >
              apply · restart rnsd
            </button>
          </div>

          <h2 className="mt-3 text-[8px] uppercase tracking-widest text-scan">interfaces</h2>
          {ifaces.length === 0 ? (
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">no source</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {ifaces.map((f) => (
                <li
                  key={f.name}
                  className={`rounded-sm border bg-card/70 px-1.5 py-1 ${
                    isOffgridIface(f.name) ? "border-warn/60" : "border-border"
                  }`}
                >
                  <span className="block truncate text-[9px] text-foreground">
                    {f.name}
                    {isOffgridIface(f.name) ? <span className="text-warn"> · no-tower</span> : null}
                  </span>
                  <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
                    {f.status} {f.rate ? `· ${f.rate}` : ""} {f.traffic ? `· ${f.traffic}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-3 text-[8px] uppercase tracking-widest text-scan">paths</h2>
          {paths.length === 0 ? (
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground">no source</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {paths.map((p) => (
                <li key={p.hash} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[9px]">
                  <span className="truncate text-warn">{p.hash.slice(0, 14)}…</span>
                  <span className="text-muted-foreground">
                    {p.via} · {p.hops}h
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : tab === "fm" ? (
        <div className="min-h-0 flex-1 overflow-y-auto face-pad py-2">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
            <button
              type="button"
              onClick={() => tune(active - 1)}
              className="rounded-sm border border-border px-2 py-1 text-[11px] leading-none text-muted-foreground active:text-signal"
            >
              −
            </button>
            <div className="rounded-sm border border-signal/50 bg-card/70 px-1.5 py-1 text-center">
              <span className="block text-[13px] font-bold leading-none text-signal">
                CH {chan.n}
              </span>
              <span className="block truncate text-[8px] uppercase tracking-widest text-muted-foreground">
                {chan.tag} · {chan.members.length} stn {chan.listen ? "· rx" : "· muted"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => tune(active + 1)}
              className="rounded-sm border border-border px-2 py-1 text-[11px] leading-none text-muted-foreground active:text-signal"
            >
              +
            </button>
          </div>

          <input
            value={chan.tag}
            onChange={(e) => putChan({ ...chan, tag: e.target.value.toUpperCase().slice(0, 16) })}
            placeholder="channel tag"
            spellCheck={false}
            className="mt-1 w-full rounded-sm border border-border bg-card/70 px-1.5 py-1 text-[9px] uppercase tracking-widest text-foreground outline-none focus:border-signal/60"
          />

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            placeholder="transmission"
            rows={2}
            className="mt-1 w-full resize-none rounded-sm border border-border bg-card/70 px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal/60"
          />

          <div className="mt-1 grid grid-cols-3 gap-1">
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void broadcast("ptt")}
              className="rounded-sm border border-signal/50 py-2 text-[10px] font-bold uppercase tracking-widest text-signal active:bg-accent disabled:opacity-40"
            >
              ptt
            </button>
            <button
              type="button"
              disabled={offline || busy}
              onClick={() => void broadcast("msg")}
              className="rounded-sm border border-border py-2 text-[9px] uppercase tracking-widest text-muted-foreground active:bg-accent disabled:opacity-40"
            >
              net msg
            </button>
            <button
              type="button"
              onClick={() => putChan({ ...chan, listen: !chan.listen })}
              className="rounded-sm border border-border py-2 text-[9px] uppercase tracking-widest text-muted-foreground active:bg-accent"
            >
              {chan.listen ? "mute" : "listen"}
            </button>
          </div>

          <div className="mt-1 flex items-center gap-1">
            <span className="text-[8px] uppercase tracking-widest text-muted-foreground">
              squelch {chan.sq}
            </span>
            <input
              type="range"
              min={0}
              max={9}
              value={chan.sq}
              onChange={(e) => putChan({ ...chan, sq: Number(e.target.value) })}
              className="h-1 min-w-0 flex-1 accent-[var(--signal)]"
            />
          </div>

          <h2 className="mt-2 text-[8px] uppercase tracking-widest text-scan">
            roster · {chan.members.length}
          </h2>
          <div className="mt-1 flex flex-wrap gap-1">
            {peers.length === 0 ? (
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
                save peers in chat first
              </span>
            ) : (
              peers.map((p) => {
                const on = chan.members.includes(p.hash);
                return (
                  <button
                    key={p.hash}
                    type="button"
                    onClick={() =>
                      putChan({
                        ...chan,
                        members: on
                          ? chan.members.filter((h) => h !== p.hash)
                          : [...chan.members, p.hash],
                      })
                    }
                    className={`rounded-sm border px-1 py-0.5 text-[8px] uppercase tracking-widest ${
                      on ? "border-signal/60 text-signal" : "border-border text-muted-foreground"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })
            )}
          </div>

          <p className="mt-1.5 break-words text-[8px] uppercase tracking-wider text-muted-foreground">
            {note || `${FEE}c per station · ${FEE * chan.members.length}c per key-up`}
          </p>

          <h2 className="mt-2 text-[8px] uppercase tracking-widest text-scan">traffic</h2>
          <ul className="mt-1 space-y-1">
            {!chan.listen ? (
              <li className="text-[9px] uppercase tracking-widest text-muted-foreground">
                channel muted
              </li>
            ) : chanMsgs.length === 0 ? (
              <li className="text-[9px] uppercase tracking-widest text-muted-foreground">
                quiet on {chan.tag}
              </li>
            ) : (
              chanMsgs.map((m, i) => {
                const h = readHeader(m.token, m.content);
                return (
                  <li
                    key={`${m.ts}-${i}`}
                    className="rounded-sm border border-border bg-card/70 px-1.5 py-1"
                  >
                    <span className="block truncate text-[8px] uppercase tracking-widest text-scan">
                      {h?.mode === "ptt" ? "◉ ptt " : ""}
                      {m.from.slice(0, 10)} · {new Date(m.ts).toLocaleTimeString()}
                    </span>
                    <span className="block break-words text-[9px] text-foreground">
                      {m.content}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto face-pad py-2">
          <p className="text-[9px] uppercase tracking-widest text-signal">
            balance {balance(chain)}c
          </p>
          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
            wallet {addr} · chain {chain.length} entries ·{" "}
            <span className={chainOk === false ? "text-alert" : "text-signal"}>
              {chainOk === null ? "verifying" : chainOk ? "signatures valid" : "TAMPERED"}
            </span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => void mint(5).then(refreshToken)}
              className="rounded-sm border border-warn/50 py-1.5 text-[9px] uppercase tracking-widest text-warn active:bg-accent"
            >
              mint 5
            </button>
            <button
              type="button"
              onClick={() => void refreshToken()}
              className="rounded-sm border border-border py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground active:bg-accent"
            >
              verify
            </button>
          </div>
          <ul className="mt-2 space-y-0.5">
            {chain
              .slice()
              .reverse()
              .slice(0, 40)
              .map((e) => (
                <li
                  key={e.hash}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 text-[8px]"
                >
                  <span className={e.kind === "spend" ? "text-alert" : "text-signal"}>
                    {e.kind}
                  </span>
                  <span className="truncate text-muted-foreground">{e.hash.slice(0, 12)}</span>
                  <span className="text-foreground">
                    {e.kind === "spend" ? "-" : "+"}
                    {e.amount}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </main>
  );
}
