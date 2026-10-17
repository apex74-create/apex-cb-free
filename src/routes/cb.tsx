/**
 * Sovereign CB — the standalone radio deck.
 *
 * Installs as its own icon (public/cb.webmanifest) and opens straight onto a
 * radio face. Same transports as the tool-deck PTT page: cloud relay, field
 * mesh, USB radio, Bluetooth, with automatic fallback.
 */
import { RadialKnob } from "@/components/RadialKnob";
import { playRx, RX_MAX, setLevel, TX_MAX, useLevels } from "@/lib/cb-audio-levels";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CB_ROUTES } from "@/lib/cb-routes";
import { useCallback, useEffect, useRef, useState } from "react";
import { CbCarrierBanner } from "@/components/CbCarrierBanner";
import AppTopBar from "@/components/AppTopBar";
import { CbMapDeck } from "@/components/CbMapDeck";
import { CbNodeInset } from "@/components/CbNodeInset";
import { CommandDeck } from "@/components/CommandDeck";
import { CbLedDigits } from "@/components/CbLedDigits";
import { FieldLinksPanel } from "@/components/FieldLinksPanel";
import { PttPaddle } from "@/components/PttPaddle";
import { RoomsPanel } from "@/components/RoomsPanel";
import { Button } from "@/components/ui/button";
import { chirp, tailStatic, tapHaptic } from "@/lib/cb-feedback";
import { cacheVoiceGrille, downloadVoiceGrille, GRILLE_LIMIT, readVoiceGrille, type VoiceClip } from "@/lib/cb-recordings";
import { scanPublicChannels } from "@/lib/cb-scan";
import { listenInvites, peerFingerprint, type InvitePeer, type IncomingInvite } from "@/lib/private-invites";
import { CB_BUS_MAX, CB_MIN } from "@/lib/channels";
import { useCbPlan } from "@/lib/use-cb-plan";
import {
  MAX_KEY_MS,
  canRecord,
  loadCallsign,
  loadFavorites,
  micPermission,
  openMic,
  requestMic,
  saveCallsign,
  toggleFavorite,
  tune,
  type MicPerm,
  type PttTx,
} from "@/lib/ptt";
import { learnPttKey, loadLearnedKey, saveLearnedKey } from "@/lib/ptt-key";
import { setKeepAliveInfo, startKeepAlive, stopKeepAlive } from "@/lib/media-session";
import {
  deriveRoomKey,
  loadActiveRoom,
  loadRooms,
  roomChannel,
  saveActiveRoom,
  upsertRoom,
} from "@/lib/rooms";

export const Route = createFileRoute("/cb")({
  head: () => ({
    meta: [
      { title: "Sovereign CB — standalone radio deck" },
      {
        name: "description",
        content:
          "A push-to-talk radio deck that installs on its own: channels 1-40, private rooms, phone-to-phone field mesh, Bluetooth and USB links, and a daylight face you can read in the sun.",
      },
      { property: "og:title", content: "Sovereign CB — standalone radio deck" },
      {
        property: "og:description",
        content:
          "Key up from any browser. Works on the cloud relay, on a hotspot, phone-to-phone with no server at all, or over a cable to a radio node.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CbDeck,
});

const THEME_KEY = "apex.cb.theme";
const LAYOUT_KEY = "apex.cb.layout";
const FX_KEY = "apex.cb.fx";
const HAPTIC_KEY = "apex.cb.haptics";

function CbDeck() {
  const [room, setRoom] = useState("19");
  const [ch, setCh] = useState(19);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [mapKeyRoom, setMapKeyRoom] = useState<string | null>(null);
  const [state, setState] = useState<"joining" | "live" | "down">("joining");
  const [log, setLog] = useState<PttTx[]>([]);
  /** callsign → last transmission time, so map routing lines can flash red */
  const [txHot, setTxHot] = useState<Record<string, number>>({});
  const [call, setCall] = useState("APEX");
  const [keyed, setKeyed] = useState(false);
  const [left, setLeft] = useState(MAX_KEY_MS / 1000);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [voice, setVoice] = useState(false);
  const [perm, setPerm] = useState<MicPerm>("unknown");
  const [favs, setFavs] = useState<number[]>([]);
  const [day, setDay] = useState(false);
  const [dim, setDim] = useState(false);
  const [awake, setAwake] = useState(false);
  const [learning, setLearning] = useState(false);
  const [hardKey, setHardKey] = useState<string | null>(null);
  const [meter, setMeter] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanChannel, setScanChannel] = useState(19);
  const [scanEnd, setScanEnd] = useState(40);
  const [scanDisplay, setScanDisplay] = useState(19);
  const [scanLed, setScanLed] = useState(0);
  const [fx, setFx] = useState(true);
  const [haptics, setHaptics] = useState(false);
  const [publicOpen, setPublicOpen] = useState(true);
  // Z Stack: CB face → map → pocket / command deck. Capped at 5 sheets (Z_STACK_MAX);
  // sheets are plain panels, depth is a usability limit, not a memory one.
  const [mapExpanded, setMapExpandedRaw] = useState(false);
  const [pocketOpen, setPocketOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const setMapExpanded = (v: boolean) => { setMapExpandedRaw(v); if (!v) { setPocketOpen(false); setDeckOpen(false); } };
  const snapShut = () => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const steps = [() => setDeckOpen(false), () => setPocketOpen(false), () => setMapExpanded(false)];
    steps.forEach((s, i) => (reduce ? s() : setTimeout(s, i * 90)));
    tapHaptic();
  };
  const [historyDocked, setHistoryDocked] = useState(false);
  const [mapDocked, setMapDocked] = useState(false);
  const [nodePosition, setNodePosition] = useState<{ point: [number, number]; accuracy: number } | null>(null);
  const [layout, setLayout] = useState<"auto" | "base" | "handset">("auto");
  useEffect(() => {
    if (!navigator.geolocation) return;
    const landscape = window.matchMedia("(orientation: landscape)");
    const wideAuto = window.matchMedia("(max-height: 640px), (min-width: 1024px)");
    let watcher: number | undefined;
    const update = () => {
      if (watcher !== undefined) navigator.geolocation.clearWatch(watcher);
      watcher = undefined;
      if (!landscape.matches || (layout !== "base" && !(layout === "auto" && wideAuto.matches))) return;
      watcher = navigator.geolocation.watchPosition(
        ({ coords }) => setNodePosition({ point: [coords.latitude, coords.longitude], accuracy: coords.accuracy }),
        () => setNodePosition(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
      );
    };
    update();
    landscape.addEventListener("change", update);
    wideAuto.addEventListener("change", update);
    return () => {
      if (watcher !== undefined) navigator.geolocation.clearWatch(watcher);
      landscape.removeEventListener("change", update);
      wideAuto.removeEventListener("change", update);
    };
  }, [layout]);
  // Message bar stays tucked until pulled down, then stays open until tucked.
  const [textOpen, setTextOpen] = useState(false);
  const textPull = useRef<number | null>(null);
  const textDragged = useRef(false);
  const peekRef = useRef<HTMLDivElement>(null);
  // Shelf drawer: 0 docked, 1 half-lifted, 2 full — drag the grab bar or tap it.
  const [shelfLift, setShelfLift] = useState<0 | 1 | 2>(0);
  const shelfDrag = useRef<{ y: number } | null>(null);
  const [zHint, setZHint] = useState(false);
  useEffect(() => { try { const v = localStorage.getItem(LAYOUT_KEY); if (v === "base" || v === "handset") setLayout(v); } catch { /* storage unavailable */ } }, []);
  const cycleLayout = () => { const next = layout === "auto" ? "base" : layout === "base" ? "handset" : "auto"; setLayout(next); try { localStorage.setItem(LAYOUT_KEY, next); } catch { /* storage unavailable */ } };
  const shelfRef = useRef<HTMLDivElement>(null);
  const dockMap = () => {
    if (shelfRef.current) shelfRef.current.scrollTop = 0;
    setMapDocked(true);
    setShelfLift(0);
  };
  const showMapAtStop = () => {
    if (shelfRef.current) shelfRef.current.scrollTop = 0;
    setMapDocked(true);
    setMapExpanded(true);
    setShelfLift(0);
  };
  const returnToControls = () => {
    setMapExpanded(false);
    setMapDocked(true);
    setShelfLift(0);
  };
  const toggleMessage = () => {
    if (textOpen) {
      // Tucking the composer returns to the public calling channel, without
      // discarding a draft or a pending invitation.
      stopScan();
      setRoom("19");
      setPublicOpen(true);
    }
    setTextOpen((open) => !open);
  };
  const historyRef = useRef<HTMLDivElement>(null);
  const edgeSwipeRef = useRef<{ x: number; y: number; edge: "left" | "right" } | null>(null);
  const [clips, setClips] = useState<VoiceClip[]>([]);
  const [clipsReady, setClipsReady] = useState(false);
  const [grilleMenu, setGrilleMenu] = useState(false);
  const [grilleWarning, setGrilleWarning] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const clipIds = useRef(new Set<string>());
  const scanRef = useRef<(() => void) | null>(null);
  const scanHitRef = useRef<PttTx | null>(null);
  const fxRef = useRef(fx);
  const [invitePeers, setInvitePeers] = useState<InvitePeer[]>([]);
  const [incoming, setIncoming] = useState<IncomingInvite | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const inviteRef = useRef<ReturnType<typeof listenInvites> | null>(null);

  const txRef = useRef<((tx: Omit<PttTx, "id" | "ts" | "ch" | "tag">) => void) | null>(null);
  const levels = useLevels();

  const sides = mapExpanded || layout === "base";
  useEffect(() => {
    if (mapExpanded && shelfRef.current) shelfRef.current.scrollTop = 0;
    if (mapExpanded) {
      setShelfLift(0);
      try {
        if (!localStorage.getItem("apex.cb.zhint")) {
          setZHint(true);
          localStorage.setItem("apex.cb.zhint", "seen");
        }
      } catch { /* storage locked */ }
    } else setZHint(false);
  }, [mapExpanded]);
  useEffect(() => {
    if (!scanning) return;
    setScanDisplay(scanChannel);
    const timer = window.setInterval(() => setScanDisplay((current) => current >= scanEnd ? scanChannel : current + 1), 80);
    return () => window.clearInterval(timer);
  }, [scanning, scanChannel, scanEnd]);
  useEffect(() => {
    if (mapExpanded || mapDocked) return;
    const shelf = shelfRef.current;
    const history = historyRef.current;
    if (!shelf || !history) return;
    const onScroll = () => {
      const shelfBox = shelf.getBoundingClientRect();
      const historyBox = history.getBoundingClientRect();
      setHistoryDocked(historyBox.bottom <= shelfBox.bottom && historyBox.top < shelfBox.bottom);
      const rail = shelf.querySelector<HTMLElement>(".cb-map-rail");
      if (rail && shelf.scrollTop > 24 && rail.getBoundingClientRect().bottom <= shelfBox.bottom + 8) {
        showMapAtStop();
      }
    };
    shelf.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => shelf.removeEventListener("scroll", onScroll);
  }, [mapExpanded, mapDocked]);
  useEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;
    const h = (historyDocked || mapDocked) && peekRef.current ? peekRef.current.offsetHeight : 0;
    shelf.style.setProperty("--cb-peek-h", `${h}px`);
  }, [historyDocked, mapDocked, log.length]);
  const micRef = useRef<Awaited<ReturnType<typeof openMic>> | null>(null);
  const cutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    void readVoiceGrille().then((stored) => {
      if (!mounted) return;
      const valid = stored.filter((clip) => typeof clip.id === "string" && typeof clip.body === "string" && clip.body.startsWith("data:audio/"));
      clipIds.current = new Set(valid.map((clip) => clip.id));
      setClips(valid.slice(0, GRILLE_LIMIT));
    }).catch(() => setNote("local voice cache unavailable — save clips before leaving")).finally(() => { if (mounted) setClipsReady(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!clipsReady) return;
    void cacheVoiceGrille(clips).catch(() => setNote("local voice cache unavailable — save clips before leaving"));
  }, [clips, clipsReady]);

  useEffect(() => {
    if (clips.length < GRILLE_LIMIT) { setGrilleWarning(false); setSaveFailed(false); return; }
    setGrilleWarning(true);
    if (saveFailed) return;
    const id = window.setTimeout(() => {
      setClips([]);
      clipIds.current.clear();
      setGrilleWarning(false);
    }, 15000);
    return () => window.clearTimeout(id);
  }, [clips, saveFailed]);

  const saveClips = () => {
    try {
      downloadVoiceGrille(clips);
      setClips([]);
      clipIds.current.clear();
      setGrilleWarning(false);
      setGrilleMenu(false);
      setNote("recordings saved to a file");
    } catch {
      setSaveFailed(true);
      setNote("file save unavailable here — clips kept on this device");
    }
  };

  /* ---- boot ---- */
  useEffect(() => {
    setCall(loadCallsign());
    setVoice(canRecord());
    setFavs(loadFavorites());
    setHardKey(loadLearnedKey()?.code ?? null);
    void micPermission().then(setPerm);
    const saved = loadActiveRoom();
    setRoom(saved);
    setCh(roomChannel(saved));
    try {
      const t = localStorage.getItem(THEME_KEY);
      setDay(t ? t === "day" : window.matchMedia?.("(prefers-color-scheme: light)").matches);
      setDim(t === "dim");
      setFx(localStorage.getItem(FX_KEY) !== "off");
      setHaptics(localStorage.getItem(HAPTIC_KEY) === "on");
    } catch {
      /* storage locked */
    }
    const p = new URLSearchParams(window.location.search).get("ch");
    const n = Number(p);
    if (Number.isInteger(n) && n >= CB_MIN && n <= CB_BUS_MAX) {
      setRoom(String(n));
      setCh(n);
    }
  }, []);

  const cbPlan = useCbPlan();
  useEffect(() => () => { scanRef.current?.(); }, []);

  useEffect(() => { fxRef.current = fx; }, [fx]);

  useEffect(() => {
    if (!scanning) return;
    const id = setInterval(() => setScanLed((v) => (v + 1) % 10), 95);
    return () => clearInterval(id);
  }, [scanning]);

  const stopScan = () => {
    scanRef.current?.();
    scanRef.current = null;
    setScanning(false);
  };

  const beginScan = () => {
    if (scanning) { stopScan(); return; }
    if (keyed) return;
    setScanning(true);
    if (haptics) tapHaptic();
  };

  /* ---- install as its own icon: point the manifest at the CB app ---- */
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const prev = link.getAttribute("href");
    link.setAttribute("href", "/cb.webmanifest");
    return () => {
      if (prev) link.setAttribute("href", prev);
    };
  }, []);

  /* ---- room key ---- */
  useEffect(() => {
    const r = loadRooms().find((x) => x.id === room);
    setKey(null);
    setMapKeyRoom(null);
    setTxHot({});
    if (!r?.code) return;
    let live = true;
    void deriveRoomKey(r.code).then((k) => { if (live) { setKey(k); setMapKeyRoom(room); } });
    return () => {
      live = false;
    };
  }, [room]);

  /* ---- tune ---- */
  useEffect(() => {
    if (scanning) {
      txRef.current = null;
      setState("joining");
      return;
    }
    if (loadRooms().some((r) => r.id === room && r.code) && !key) {
      setState("joining");
      return;
    }
    saveActiveRoom(room);
    const n = roomChannel(room);
    setCh(n);
    const found = scanHitRef.current;
    scanHitRef.current = null;
    setLog(found && found.ch === n ? [{ ...found, mine: false }] : []);
    const t = tune(
      n,
      (tx) => {
        setLog((l) => [tx, ...l].slice(0, 40));
        setTxHot((m) => ({ ...m, [tx.from]: Date.now() }));
        if (tx.kind === "voice" && tx.body.startsWith("data:audio/") && !clipIds.current.has(tx.id)) {
          clipIds.current.add(tx.id);
          setClips((previous) => previous.length < GRILLE_LIMIT ? [...previous, { id: tx.id, from: tx.from, ts: tx.ts, body: tx.body, ch: tx.ch }] : previous);
        }
        if (!tx.mine) setMeter(1);
      },
      setState,
      { roomId: room, key },
    );
    txRef.current = t.transmit;
    return () => {
      txRef.current = null;
      t.leave();
    };
  }, [room, key, scanning]);

  /* Subscribe only after the previous tuned listener has been cleaned up. */
  useEffect(() => {
    if (!scanning) return;
    // Start each sweep at the first public block: 1–20, then 21–40.
    const stop = scanPublicChannels(CB_MIN, setScanChannel, (found, tx) => {
      scanHitRef.current = tx;
      setRoom(String(found));
      setScanning(false);
      setMeter(1);
      if (fx) chirp();
      if (haptics) tapHaptic([20, 35, 20]);
    }, { total: cbPlan.scanTotal, onBlock: (block) => { setScanChannel(block.from); setScanEnd(block.to); } });
    scanRef.current = stop;
    return () => {
      stop();
      if (scanRef.current === stop) scanRef.current = null;
    };
  }, [scanning]);

  useEffect(() => {
    setInvitePeers([]);
    setIncoming(null);
    const listener = listenInvites(room, call, setInvitePeers, setIncoming, (acceptedRoom) => {
      upsertRoom(acceptedRoom);
      setRoom(acceptedRoom.id);
      setInviteMessage(`private room ${acceptedRoom.id} joined`);
    });
    inviteRef.current = listener;
    return () => {
      inviteRef.current = null;
      listener.close();
    };
  }, [room, call]);

  const requestPrivate = async (peer: InvitePeer) => {
    try {
      setInviteMessage(`requesting ${peer.call} · verify device ${peerFingerprint(peer.pub)}`);
      await inviteRef.current?.request(peer);
    } catch {
      setInviteMessage("private request failed — use a shared invite instead");
    }
  };

  const respondPrivate = async (accept: boolean) => {
    const request = incoming;
    if (!request) return;
    try {
      await inviteRef.current?.respond(request, accept);
      if (accept) {
        upsertRoom(request.room);
        setRoom(request.room.id);
      }
      setInviteMessage(accept ? `joined ${request.room.id}` : "request declined");
    } catch {
      setInviteMessage("could not reply — try again");
    }
    setIncoming(null);
  };

  /* ---- signal meter decay ---- */
  useEffect(() => {
    if (meter <= 0) return;
    const id = setTimeout(() => setMeter((m) => Math.max(0, m - 0.2)), 220);
    return () => clearTimeout(id);
  }, [meter]);

  /* ---- notification player line ---- */
  useEffect(() => {
    if (!awake) return;
    setKeepAliveInfo(
      room,
      `${state === "live" ? "monitoring" : "local links"} · ${key ? "locked" : "open"}`,
    );
  }, [awake, room, state, key]);

  useEffect(() => () => stopKeepAlive(), []);

  /* ---- inbound audio ---- */
  useEffect(() => {
    const latest = log[0];
    if (!latest || latest.mine) return;
    if (latest.kind === "text") {
      if (fxRef.current) chirp();
      return;
    }
    const a = playRx(latest.body);
    a.onended = () => { if (fxRef.current) tailStatic(); };
    void a.play().catch(() => setNote("tap the screen once to allow audio"));
    return () => { a.onended = null; a.pause(); };
  }, [log]);

  const tuneTo = (n: number) => {
    stopScan();
    if (haptics) tapHaptic();
    const max = cbPlan.channelMax;
    const w = n < CB_MIN ? max : n > max ? CB_MIN : n;
    setRoom(String(w));
  };

  const release = useCallback(async () => {
    if (cutRef.current) clearTimeout(cutRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    setKeyed(false);
    setLeft(MAX_KEY_MS / 1000);
    const mic = micRef.current;
    if (!mic) return;
    const url = await mic.stop();
    mic.close();
    micRef.current = null;
    if (!url) return setNote("nothing captured — hold longer, keep it under 8s");
    txRef.current?.({ kind: "voice", from: call, body: url });
    if (fx) tailStatic();
    if (haptics) tapHaptic(16);
    setNote("");
  }, [call, fx, haptics]);

  const press = useCallback(async () => {
    if (!voice) return false;
    setNote("");
    try {
      const mic = await openMic();
      micRef.current = mic;
      mic.start();
      if (fx) chirp();
      if (haptics) tapHaptic(22);
      setKeyed(true);
      setLeft(MAX_KEY_MS / 1000);
      tickRef.current = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
      cutRef.current = setTimeout(() => void release(), MAX_KEY_MS);
      return true;
    } catch {
      setPerm("denied");
      setNote("mic denied — allow the microphone in site settings; text still transmits");
      return false;
    }
  }, [voice, release, fx, haptics]);

  const grant = async () => {
    setNote("");
    const next = await requestMic();
    setPerm(next);
    if (next === "granted") setVoice(true);
    else if (next === "denied") setNote("mic blocked — allow it in browser site settings");
  };

  const sendText = () => {
    const body = text.trim();
    if (!body || (loadRooms().some((r) => r.id === room && r.code) && !key)) return;
    txRef.current?.({ kind: "text", from: call, body });
    if (fx) tailStatic();
    if (haptics) tapHaptic();
    setText("");
  };

  const toggleAwake = async () => {
    if (awake) {
      stopKeepAlive();
      setAwake(false);
      return;
    }
    const ok = await startKeepAlive({
      channelUp: () => tuneTo(roomChannel(room) + 1),
      channelDown: () => tuneTo(roomChannel(room) - 1),
      monitor: () => {},
    });
    setAwake(ok);
    if (!ok) setNote("background mode not available in this browser");
  };

  const learn = async () => {
    setLearning(true);
    setNote("press your handset side button now");
    const { done } = learnPttKey();
    const k = await done;
    setLearning(false);
    setHardKey(k?.code ?? null);
    setNote(k ? `side key learned: ${k.code}` : "no key captured — try again");
  };

  return (
    <main className={`cb-deck relative flex h-app w-full flex-col overflow-hidden bg-background p-1 font-bold ${day ? "cb-day" : dim ? "cb-dim" : ""} cb-layout-${layout}`}>
      {layout === "base" && <div className="cb-base-rim" aria-hidden="true">
        <span className="cb-rim-chase cb-rim-left" />
        <span className="cb-rim-chase cb-rim-bottom" />
        <span className="cb-rim-chase cb-rim-right" />
      </div>}
      <div
        className="cb-bezel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl"
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (!t) return;
          const box = e.currentTarget.getBoundingClientRect();
          const fromLeft = t.clientX - box.left;
          const fromRight = box.right - t.clientX;
          const edge = fromRight <= 28 ? "right" : fromLeft <= 28 ? "left" : null;
          edgeSwipeRef.current = edge || pocketOpen || deckOpen ? { x: t.clientX, y: t.clientY, edge: edge ?? "right" } : null;
        }}
        onTouchEnd={(e) => {
          const start = edgeSwipeRef.current;
          edgeSwipeRef.current = null;
          if (!start) return;
          const t = e.changedTouches[0];
          if (!t) return;
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 56) return;
          // Z Stack: controls → (right) full map → (left gap) pocket | (right gap) command deck.
          if (pocketOpen) { if (dx < 0) setPocketOpen(false); return; }
          if (deckOpen) { if (dx > 0) setDeckOpen(false); return; }
          if (start.edge === "right" && dx < 0 && !mapExpanded) setMapExpanded(true);
          else if (start.edge === "right" && dx < 0 && mapExpanded) setDeckOpen(true);
          else if (start.edge === "left" && dx > 0 && mapExpanded) setPocketOpen(true);
        }}
      >
      {mapExpanded && (
        <Button
          type="button"
          onClick={snapShut}
          aria-label="Snap all drawers shut and return to the CB face"
          className="app-snap absolute bottom-3 left-1/2 z-[60] h-5 -translate-x-1/2 border border-warn bg-background/40 px-2 py-0 text-[10px] font-bold uppercase text-signal"
        >
          Snap shut
        </Button>
      )}
      {zHint && mapExpanded && !deckOpen && !pocketOpen && (
        <div role="status" className="absolute left-1/2 top-3 z-[60] -translate-x-1/2 rounded-full border border-warn bg-background/95 px-4 py-1.5 text-[12px] font-bold uppercase tracking-widest text-warn">
          Swipe in from the bezel edges — pocket left, deck right
        </div>
      )}
      {sides && !deckOpen && !pocketOpen && (
        <button
          type="button"
          onClick={() => setDeckOpen(true)}
          aria-label="Open the command deck (notes and snippets)"
          className="z-tab z-tab-right absolute right-0 top-1/2 z-40 -translate-y-1/2"
        >
          <span className="z-tab-chev" aria-hidden="true">‹</span>
          <span className="z-tab-label">Deck</span>
        </button>
      )}
      {sides && deckOpen && <CommandDeck onClose={() => setDeckOpen(false)} status={`${room} · ${call || "no handle"}${scanning ? " · scanning" : ""}`} />}
      {sides && !pocketOpen && !deckOpen && (
        <button
          type="button"
          onClick={() => setPocketOpen(true)}
          aria-label="Open the hidden pocket (handles and contacts)"
          className="z-tab z-tab-left absolute left-0 top-1/2 z-40 -translate-y-1/2"
        >
          <span className="z-tab-chev" aria-hidden="true">›</span>
          <span className="z-tab-label">Pocket</span>
        </button>
      )}
      {sides && pocketOpen && (
        <aside className="z-sheet z-sheet-left absolute inset-y-0 left-0 z-50 flex w-[min(82%,340px)] flex-col border-r-2 border-warn bg-background/95 p-3 text-[14px] uppercase" aria-label="Hidden pocket">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="tracking-[0.2em] text-signal">Pocket</span>
            <button type="button" onClick={() => setPocketOpen(false)} className="px-2 text-[20px] leading-none text-muted-foreground" aria-label="Close pocket">‹</button>
          </div>
          <p className="mt-2 text-muted-foreground">Your handle</p>
          <p className="text-[18px] text-foreground">{call || "no handle set"}</p>
          <p className="mt-3 text-muted-foreground">Handles heard on {room}</p>
          <ul className="mt-1 flex flex-col gap-1 overflow-y-auto">
            {[...new Set(log.filter((t) => !t.mine).map((t) => t.from))].slice(0, 12).map((h) => (
              <li key={h} className="border border-border bg-card/50 px-2 py-1 text-foreground">{h}</li>
            ))}
            {!log.some((t) => !t.mine) && <li className="border border-border bg-card/50 px-2 py-1 text-muted-foreground">nobody heard yet</li>}
          </ul>
          <p className="mt-auto border-t border-border pt-2 text-[12px] text-muted-foreground">Saved contact list arrives with its privacy lock. Stays on this device.</p>
        </aside>
      )}
      <span className="cb-rim-chase cb-rim-left" aria-hidden="true" />
      <span className="cb-rim-chase cb-rim-bottom" aria-hidden="true" />
      <span className="cb-rim-chase cb-rim-right" aria-hidden="true" />
      <AppTopBar
        title="Sovereign CB"
        backTo="/app"
        storageKey="cb"
        layout={layout}
        onCycleLayout={cycleLayout}
      >
        <Button variant="ghost" asChild className="app-hbtn h-8 px-1.5 text-[11px] uppercase"><a href={CB_ROUTES.face}>Face</a></Button>
        <Button variant="ghost" asChild className="app-hbtn h-8 px-1.5 text-[11px] uppercase"><Link to={CB_ROUTES.entry}>Sales</Link></Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => { const next = day ? "night" : dim ? "day" : "dim"; setDay(next === "day"); setDim(next === "dim"); try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ } }}
          className="app-hbtn h-8 shrink-0 rounded-sm px-1.5 text-[11px] uppercase tracking-widest text-muted-foreground active:text-signal"
          aria-label={`Display: ${day ? "day" : dim ? "ultra dim" : "night"}. Change display`}
        >
          {day ? "day" : dim ? "dim" : "night"}
        </Button>
      </AppTopBar>
      <CbCarrierBanner />

      <div className="z-10 shrink-0 border-b border-border face-pad py-1">
        <span
          className={`block truncate text-[18px] uppercase tracking-widest ${state === "live" ? "text-signal" : state === "joining" ? "text-warn" : "text-alert"}`}
        >
          {state === "live"
            ? "● net live · auto-reconnect on"
            : state === "joining"
              ? "◌ tuning"
              : "○ relay down · retrying · local links still work"}
          {" · "}
          {key ? "locked room" : "open"}
          {" · "}
          {voice ? "voice+text" : "text only"}
        </span>
      </div>

      <div className="shrink-0 border-b border-border face-pad py-1">
        {/* Receiver race and controls flank the channel display. */}
        <div className="cb-channel-console grid grid-cols-[minmax(106px,32%)_minmax(0,1fr)] gap-2">
          <div className="cb-channel-controls flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card/60 p-2">
            <div className="flex items-center justify-between text-[11px] uppercase text-muted-foreground"><span>RF</span><span>{scanning ? "scan" : "signal"}</span></div>
            <div className="grid grid-cols-5 gap-1" aria-label={scanning ? `Scanning channels ${scanChannel} through ${scanEnd}` : "Receiver strength"}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`h-3 rounded-[2px] transition-colors ${scanning && i === scanLed ? "bg-warn cb-scan-led" : !scanning && i < Math.max(1, Math.round(meter * 10)) ? "bg-signal" : "bg-muted"}`} />
              ))}
            </div>
            <div className="flex items-center justify-around gap-1 border-t border-border pt-1" aria-label="Receive and transmit volume">
              <RadialKnob label="rx" value={levels.rx} max={RX_MAX} onChange={(v) => setLevel("rx", v)} haptics={haptics} size={32} />
              <RadialKnob label="tx" value={levels.tx} max={TX_MAX} onChange={(v) => setLevel("tx", v)} haptics={haptics} size={32} />
            </div>
            <div className="mt-auto flex flex-col gap-1.5 pt-2">
              <Button type="button" variant={scanning ? "default" : "outline"} aria-pressed={scanning} onClick={beginScan} className="h-10 min-w-0 px-1 text-[15px] uppercase">{scanning ? "stop scan" : "scan"}</Button>
              <Button type="button" variant="outline" aria-pressed={!fx} onClick={() => { setFx(!fx); try { localStorage.setItem(FX_KEY, fx ? "off" : "on"); } catch { /* storage unavailable */ } }} className="h-10 min-w-0 px-1 text-[15px] uppercase">fx {fx ? "on" : "silent"}</Button>
              <Button type="button" variant="outline" aria-pressed={haptics} onClick={() => { setHaptics(!haptics); try { localStorage.setItem(HAPTIC_KEY, haptics ? "off" : "on"); } catch { /* storage unavailable */ } if (!haptics) tapHaptic(); }} className="h-10 min-w-0 px-1 text-[15px] uppercase">tap {haptics ? "on" : "off"}</Button>
            </div>
          </div>
          <div className="cb-channel-display flex min-w-0 flex-col items-center justify-between rounded-lg border border-warn bg-card p-2 text-center">
            <span className="text-[12px] font-bold uppercase text-muted-foreground">Channel</span>
            <CbLedDigits value={scanning ? scanDisplay : ch} label={scanning ? `Scanning public channels ${scanChannel} through ${scanEnd}, showing ${scanDisplay}` : `Channel ${ch}`} />
            <span className="min-h-7 max-w-full break-words text-[13px] uppercase text-muted-foreground">
              {scanning ? `listening ${scanChannel}–${scanEnd} · ${cbPlan.scanTotal} total` : room.includes(".") ? `room ${room}` : "calling channel"}{key ? " · locked" : ""}
            </span>
            <div className="flex w-full items-center justify-between gap-2 border-t border-border pt-2">
              <Button type="button" variant="outline" size="icon" onClick={() => tuneTo(ch - 1)} aria-label="channel down" className="h-9 w-10 shrink-0 text-[25px]">−</Button>
              {cbPlan.signedIn && cbPlan.device !== "ok" ? (
                <button type="button" onClick={cbPlan.recheck} className="min-w-0 text-[11px] uppercase text-warn underline" aria-label="Licence not confirmed on this device. Check again">
                  {cbPlan.device === "limit" ? "device limit · recheck" : "licence not confirmed · recheck"}
                </button>
              ) : (
                <span className="min-w-0 text-[11px] uppercase text-muted-foreground">{scanning ? "auto lock" : `on air · 1–${cbPlan.channelMax}`}</span>
              )}
              <Button type="button" variant="outline" size="icon" onClick={() => tuneTo(ch + 1)} aria-label="channel up" className="h-9 w-10 shrink-0 text-[25px]">+</Button>
            </div>
          </div>
        </div>

      </div>
      <div className="shrink-0 border-b border-border face-pad pt-1">
        <PttPaddle
          onOpen={press}
          onSend={release}
          keyed={keyed}
          disabled={scanning || !voice || perm === "denied"}
          disabledLabel={scanning ? "stop scan to talk" : perm === "denied" ? "mic blocked" : "mic unavailable"}
          remaining={left}
        />
      </div>
      {!mapExpanded && !mapDocked && (
        <button
          type="button"
          aria-label={`Shelf drawer: ${shelfLift === 0 ? "docked" : shelfLift === 1 ? "half open" : "fully open"}. Drag or tap to ${shelfLift === 2 ? "dock" : "lift"}.`}
          className="cb-shelf-grab z-30 flex h-2.5 shrink-0 cursor-grab touch-none items-center justify-center border-x border-t border-warn/60 bg-card/60 active:cursor-grabbing"
          onPointerDown={(e) => { shelfDrag.current = { y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerUp={(e) => {
            const start = shelfDrag.current;
            shelfDrag.current = null;
            if (!start) return;
            const dy = e.clientY - start.y;
            if (dy < -24) setShelfLift((v) => (v === 2 ? 2 : ((v + 1) as 0 | 1 | 2)));
            else if (dy > 24) setShelfLift((v) => (v === 0 ? 0 : ((v - 1) as 0 | 1 | 2)));
            else setShelfLift((v) => (v === 2 ? 0 : ((v + 1) as 0 | 1 | 2)));
            if (haptics) tapHaptic();
          }}
          onPointerCancel={() => { shelfDrag.current = null; }}
        >
          <span className="h-0.5 w-12 rounded-full bg-warn" aria-hidden="true" />
        </button>
      )}
      <div
        ref={shelfRef}
        style={!mapExpanded && !mapDocked && shelfLift > 0 ? { position: "fixed", left: 4, right: 4, bottom: 4, top: shelfLift === 2 ? 8 : "38%", zIndex: 30 } : undefined}
        className={`cb-radio-shelf min-h-0 face-pad py-1 ${mapExpanded || mapDocked ? "flex flex-1 flex-col overflow-hidden" : "overflow-y-auto"} ${!mapExpanded && !mapDocked && shelfLift > 0 ? "cb-shelf-lit rounded-t-lg border-2 border-warn bg-background" : "flex-1"} ${mapDocked ? "cb-map-docked cb-shelf-lit" : ""}`}
      >
        {!mapExpanded && !mapDocked && shelfLift > 0 && (
          <button
            type="button"
            aria-label="Dock the shelf drawer"
            className="sticky top-0 z-10 mb-1 flex h-5 w-full cursor-grab touch-none items-center justify-center rounded-sm bg-card/80 active:cursor-grabbing"
            onPointerDown={(e) => { shelfDrag.current = { y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerUp={(e) => {
              const start = shelfDrag.current;
              shelfDrag.current = null;
              if (!start) return;
              const dy = e.clientY - start.y;
              if (dy < -24) setShelfLift((v) => (v === 2 ? 2 : ((v + 1) as 0 | 1 | 2)));
              else if (dy > 24) setShelfLift((v) => (v === 0 ? 0 : ((v - 1) as 0 | 1 | 2)));
              else setShelfLift((v) => (v === 2 ? 0 : ((v + 1) as 0 | 1 | 2)));
              if (haptics) tapHaptic();
            }}
            onPointerCancel={() => { shelfDrag.current = null; }}
          >
            <span className="h-1 w-16 rounded-full bg-warn" aria-hidden="true" />
          </button>
        )}
        <div className={mapExpanded || mapDocked ? "hidden" : ""}>

        {perm !== "granted" && perm !== "unsupported" ? (
          <button
            type="button"
            onClick={() => void grant()}
            className="mb-1 w-full rounded-sm border border-signal/60 px-2 py-1 text-[18px] uppercase tracking-widest text-signal active:bg-accent"
          >
            enable microphone
          </button>
        ) : null}

        <Button
          type="button"
          aria-expanded={textOpen}
          aria-label={textOpen ? "Tuck the message bar away" : "Pull down to type a message"}
          onClick={() => { if (textDragged.current) { textDragged.current = false; return; } toggleMessage(); }}
          onPointerDown={(e) => { textPull.current = e.clientY; }}
          onPointerUp={(e) => { const s = textPull.current; textPull.current = null; if (s != null && Math.abs(e.clientY - s) > 18) { textDragged.current = true; if (textOpen && e.clientY < s) toggleMessage(); else if (!textOpen && e.clientY > s) setTextOpen(true); } }}
          className="cb-text-pull mb-1 flex h-6 w-full touch-none items-center justify-center gap-2 rounded-sm border border-border/70 bg-card/40 text-[12px] uppercase tracking-widest text-muted-foreground"
        >
          <span aria-hidden="true">{textOpen ? "▴" : "▾"}</span>{textOpen ? "message" : text.trim() ? "message · draft" : "pull for message"}
        </Button>
        {textOpen && <div className="mb-1 flex gap-1">
          <textarea
            aria-label="text transmission"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendText(); } }}
            placeholder="Type a message"
            className="min-h-14 min-w-0 flex-1 resize-none rounded-sm border-[3px] border-warn bg-card px-3 py-2 text-[18px] font-bold leading-snug text-foreground placeholder:text-muted-foreground outline-none focus:border-signal"
          />
          <Button
            type="button"
            onClick={sendText}
            disabled={scanning || !text.trim() || (loadRooms().some((r) => r.id === room && r.code) && !key)}
            className="h-auto min-h-14 shrink-0 rounded-sm border-2 border-warn px-3 text-[18px] font-bold uppercase text-foreground"
          >
            send
          </Button>
        </div>}

        {incoming ? (
          <div role="alert" className="mb-2 border-2 border-signal bg-card p-2 text-[18px] font-bold text-foreground">
            <p>Private request from {incoming.from} → {incoming.room.id}</p>
            <p className="text-[16px] text-warn">Device {incoming.fingerprint} · confirm with {incoming.from} before accepting</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" onClick={() => void respondPrivate(true)}>Accept</Button>
              <Button type="button" variant="outline" onClick={() => void respondPrivate(false)}>Decline</Button>
            </div>
          </div>
        ) : null}
        {inviteMessage ? <p role="status" className="mb-1 text-[16px] text-warn">{inviteMessage}</p> : null}
        {textOpen && room.includes(".") ? <p className="mb-1 border-l-4 border-signal px-2 text-[18px] text-signal">● private subchannel {room}{key ? " · locked" : " · open"}</p> : null}
        {textOpen && invitePeers.length ? (
          <div className="mb-2 flex flex-wrap items-center gap-1 text-[16px] text-muted-foreground">
            <span>Private request:</span>
            {invitePeers.map((peer) => <Button key={peer.id} type="button" variant="outline" className="h-auto rounded-sm text-[16px]" onClick={() => void requestPrivate(peer)} title={`Device ${peerFingerprint(peer.pub)} — verify identity before sharing`}>{peer.call} ↗</Button>)}
          </div>
        ) : null}

        {textOpen && <>
        {/* presets */}
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {favs.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => tuneTo(n)}
              className={`rounded-sm border px-1.5 py-1 text-[18px] font-bold tracking-widest ${
                n === ch && !room.includes(".")
                  ? "border-signal bg-signal/15 text-signal"
                  : "border-border text-muted-foreground"
              }`}
            >
              {String(n).padStart(2, "0")}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFavs(toggleFavorite(ch))}
            className="ml-auto mr-1 shrink-0 rounded-full border border-border px-1.5 py-1 text-[16px] uppercase tracking-widest text-muted-foreground active:text-signal"
          >
            {favs.includes(ch) ? "− preset" : "+ preset"}
          </button>
        </div>

        <RoomsPanel channel={ch} active={room} onSelect={(id) => { stopScan(); if (haptics) tapHaptic(); setRoom(id); }} />
        <FieldLinksPanel />
        </>}

        {/* background + side key */}
        <div className="mb-1 flex gap-1">
          <button
            type="button"
            onClick={() => void toggleAwake()}
            className={`flex-1 rounded-sm border px-1.5 py-1 text-[16px] uppercase tracking-widest ${
              awake ? "border-signal text-signal" : "border-border text-muted-foreground"
            }`}
          >
            {awake ? "background on" : "keep live in background"}
          </button>
          <button
            type="button"
            onClick={() => void learn()}
            className="flex-1 rounded-sm border border-border px-1.5 py-1 text-[16px] uppercase tracking-widest text-muted-foreground active:text-signal"
          >
            {learning ? "press it now…" : hardKey ? `side key: ${hardKey}` : "learn my side key"}
          </button>
        </div>
        {hardKey ? (
          <button
            type="button"
            onClick={() => {
              saveLearnedKey(null);
              setHardKey(null);
            }}
            className="mb-1 w-full rounded-sm border border-border px-1.5 py-1 text-[16px] uppercase tracking-widest text-muted-foreground"
          >
            forget side key
          </button>
        ) : null}

        <div className="mb-1 flex gap-1">
          <input
            value={call}
            onChange={(e) => setCall(e.target.value.toUpperCase())}
            onBlur={() => saveCallsign(call)}
            maxLength={12}
            spellCheck={false}
            aria-label="callsign"
            className="min-w-0 flex-1 rounded-sm border border-border bg-card/50 px-1.5 py-1 text-[18px] uppercase tracking-widest text-muted-foreground outline-none focus:border-signal/60"
          />
        </div>

        {note ? <p className="mb-1 text-[16px] uppercase tracking-wider text-warn">{note}</p> : null}

        </div>
        {mapDocked && !mapExpanded && <div className="mb-1 flex shrink-0 items-center justify-between gap-2 border-b border-border pb-1">
          <span className="truncate text-[12px] uppercase text-warn">Channel {room} · map</span>
          <Button type="button" size="sm" variant="outline" className="h-6 shrink-0 border-warn/50 bg-card/30 px-2 text-[11px] text-muted-foreground" onClick={() => { setMapDocked(false); setShelfLift(0); }} aria-label="Return to radio drawer">Radio drawer</Button>
        </div>}
        {mapDocked && !mapExpanded && <Button
          type="button"
          aria-expanded={textOpen}
          onClick={toggleMessage}
          className="mb-1 h-7 shrink-0 border border-border bg-card/40 text-[12px] uppercase text-muted-foreground"
        >{textOpen ? "▴ tuck message" : text.trim() ? "▾ message · draft" : "▾ pull for message"}</Button>}
        {mapDocked && !mapExpanded && textOpen && <div className="mb-1 flex shrink-0 gap-1">
          <textarea aria-label="text transmission" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" className="min-h-14 min-w-0 flex-1 resize-none rounded-sm border border-warn bg-card px-2 py-1 text-[16px] text-foreground" />
          <Button type="button" onClick={sendText} disabled={scanning || !text.trim() || (loadRooms().some((r) => r.id === room && r.code) && !key)} className="h-auto shrink-0">Send</Button>
        </div>}
        {mapDocked && !mapExpanded && !textOpen && <section className="cb-public-docked shrink-0 overflow-y-auto border-y border-border px-1 py-1" aria-label="Public channel 19 conversation">
          <div className="text-[12px] uppercase text-warn">Public · channel 19</div>
          {room === "19" && log.filter((tx) => tx.kind !== "voice").slice(0, 3).map((tx) => <p key={tx.id} className="truncate text-[12px] text-foreground" title={tx.body}>{tx.mine ? "me" : tx.from}: {tx.body}</p>)}
          {room === "19" && !log.some((tx) => tx.kind !== "voice") && <p className="text-[12px] text-muted-foreground">channel quiet — key up to call</p>}
        </section>}
        <div ref={historyRef} className={mapExpanded || mapDocked ? "hidden" : "cb-history-dock"}>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <h2 className="text-[19px] uppercase text-warn">{room === "19" ? "public · channel 19" : `conversation · ${room}`}</h2>
          <Button type="button" variant="outline" onClick={() => { stopScan(); setRoom("19"); setPublicOpen(true); if (haptics) tapHaptic(); }} className="h-9 px-2 text-[15px] uppercase" aria-label="Go to public channel 19">go to 19</Button>
        </div>
        <Button type="button" variant="ghost" aria-expanded={publicOpen} onClick={() => { setPublicOpen(!publicOpen); if (haptics) tapHaptic(); }} className="mb-2 h-8 px-1 text-[15px] uppercase text-muted-foreground">{publicOpen ? "hide conversation −" : "show conversation +"}</Button>
        {publicOpen && <ul className="cb-history-list space-y-1" aria-live="polite">
          {log.filter((t) => t.kind !== "voice").map((t) => (
            <li key={t.id} className="rounded-sm border border-border bg-card/50 px-1.5 py-1">
              <span className="block truncate text-[16px] uppercase tracking-wider text-muted-foreground">
                {t.mine ? "me" : t.from} · {new Date(t.ts).toLocaleTimeString()}
                {t.hops ? ` · relayed ${t.hops} hop${t.hops > 1 ? "s" : ""}` : ""}
              </span>
              {!t.mine && invitePeers.filter((peer) => peer.call === t.from).map((peer) => (
                <Button key={peer.id} variant="outline" type="button" className="mb-1 h-auto rounded-sm text-[16px]" onClick={() => void requestPrivate(peer)}>Private request ↗</Button>
              ))}
              <span className="block break-words text-[20px] text-foreground">{t.body}</span>
            </li>
          ))}
          {log.length === 0 ? (
            <li className="text-[18px] text-muted-foreground">channel quiet — key up to call</li>
          ) : null}
        </ul>}

        <section className="cb-grille mb-2 mt-2 overflow-hidden rounded-lg border p-2" aria-label="Voice recordings">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[15px] uppercase text-foreground">Voice · {clips.length}/{GRILLE_LIMIT}</h2>
            <Button type="button" variant="ghost" size="icon" aria-label="Voice recording menu" aria-expanded={grilleMenu} onClick={() => setGrilleMenu(!grilleMenu)} className="h-8 w-8 text-[23px] text-muted-foreground">☰</Button>
          </div>
          {grilleMenu ? <div className="mb-2 flex gap-2">
            <Button type="button" variant="outline" disabled={!clips.length} onClick={saveClips} className="h-8 text-[13px]">Save file ↓</Button>
            <Button type="button" variant="outline" disabled={!clips.length} onClick={() => { setClips([]); clipIds.current.clear(); setGrilleMenu(false); }} className="h-8 text-[13px]">Clear</Button>
          </div> : null}
          <div className="space-y-1">
            {Array.from({ length: Math.min(5, GRILLE_LIMIT) }, (_, index) => {
              const clip = clips[index];
              if (!clip) return <div key={index} className="cb-grille-slot flex h-8 items-center gap-2 rounded-md px-2" aria-label={`Empty voice slot ${index + 1}`}><span className="cb-grille-led" /><span className="cb-grille-stripe flex-1" /></div>;
              return <div key={clip.id} className="cb-grille-slot cb-grille-filled flex min-h-10 items-center gap-2 rounded-md px-2">
                <span className={`cb-grille-led ${playingClip === clip.id ? "cb-grille-playing" : ""}`} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{clip.from} · {new Date(clip.ts).toLocaleTimeString()}</span>
                <audio controls src={clip.body} aria-label={`Voice clip ${index + 1} from ${clip.from}`} onPlay={() => setPlayingClip(clip.id)} onPause={() => setPlayingClip(null)} onEnded={() => setPlayingClip(null)} className="cb-grille-audio h-8 w-28 max-w-[42%] shrink-0" />
              </div>;
            })}
          </div>
          {grilleWarning ? <div role="alert" className="cb-grille-warning mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warn p-2 text-[13px] text-warn"><span>{saveFailed ? "File save unavailable · clips kept here" : "8 clips full · save before the stack clears"}</span><Button type="button" onClick={saveClips} className="h-9 px-3">Save file ↓</Button></div> : null}
        </section>

        </div>
        <div className={mapExpanded || mapDocked ? "hidden" : ""}>
        <p className="mt-1 border-t border-border pt-1 text-[16px] uppercase tracking-wider text-muted-foreground">
          wi-fi · bluetooth · usb links are encrypted. audio handed to a 27 mhz radio over a cable
          stays in the clear.
        </p>

        </div>
        {(mapExpanded || mapDocked || historyDocked) && <div ref={peekRef} className={`cb-history-peek shrink-0 border-y-2 border-warn bg-background py-1 text-[13px] uppercase text-muted-foreground ${historyDocked && !mapDocked ? "cb-history-peek-docked" : ""}`} aria-label="Recent calls">
          <div className="flex items-center justify-between gap-2"><span>Call history · {room}</span><span>{log.length} calls</span></div>
          <div className="mt-1 flex gap-1 overflow-x-auto">
            {Array.from({ length: 5 }, (_, i) => {
              const t = log[i];
              if (!t) return <div key={`e${i}`} className="cb-peek-cell flex min-w-0 flex-1 basis-0 items-center gap-1 border border-border bg-card/30 px-1 py-1" aria-hidden="true"><span className="cb-grille-led" /></div>;
              return <div key={t.id} className="cb-peek-cell flex min-w-0 flex-1 basis-0 items-center gap-1 border border-border bg-card/50 px-1 py-1 text-foreground" title={`${t.mine ? "me" : t.from}: ${t.kind === "voice" ? "voice" : t.body}`} aria-label={`${t.mine ? "me" : t.from}: ${t.kind === "voice" ? "voice" : t.body}`}>
                <span className={`cb-grille-led ${t.kind === "voice" ? "cb-grille-playing" : ""}`} />
                <span className="min-w-0 truncate max-[420px]:hidden">{t.mine ? "me" : t.from} · {t.kind === "voice" ? "voice" : t.body}</span>
              </div>;
            })}
          </div>
          <div className="cb-history-peek-grille mt-1" aria-hidden="true"><i /><i /><i /></div>
        </div>}
        <CbMapDeck key={room} room={room} roomKey={mapKeyRoom === room ? key : null} privateRoom={loadRooms().some((r) => r.id === room && !!r.code)} callsign={call} keyed={keyed} fullMap={mapExpanded} docked={mapDocked} messageOpen={textOpen} enableLiveFollow={layout === "handset" && (mapExpanded || mapDocked)} onDockMap={dockMap} onFullMapChange={(next) => next ? setMapExpanded(true) : returnToControls()} txHot={mapKeyRoom === room || !loadRooms().some((r) => r.id === room && r.code) ? txHot : {}} />
      </div>
      {!mapExpanded && layout !== "handset" && <CbNodeInset position={nodePosition?.point ?? null} accuracy={nodePosition?.accuracy ?? null} />}
      </div>
    </main>
  );
}
