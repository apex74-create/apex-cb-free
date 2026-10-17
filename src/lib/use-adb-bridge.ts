import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadEndpoints,
  loadTarget,
  parseFrame,
  type BridgeEndpoint,
  type InFrame,
  type LinkState,
  type OutFrame,
} from "./bridge";
import { currentAutonomy, onSettingsChange, type Autonomy } from "./watch-settings";
import { buildCandidates, discoverAgents, insecureBlocked } from "./discovery";
import { isBlockedWs, saveEndpoints, saveTarget } from "./bridge";

export type LogLine = {
  id: string;
  at: number;
  kind: "sent" | "out" | "err" | "sys";
  text: string;
};

const MAX_LOG = 120;

/**
 * Live WebSocket client for the ADB bridge with ordered failover:
 * PC agent -> phone agent -> cloud relay. If the active socket drops we
 * advance to the next enabled endpoint, wrapping around with backoff.
 */
export function useAdbBridge(enabled = true) {
  const [endpoints, setEndpoints] = useState<BridgeEndpoint[]>([]);
  const [target, setTargetState] = useState<string>("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [state, setState] = useState<LinkState>("idle");
  const [log, setLog] = useState<LogLine[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [autonomy, setAutonomy] = useState<Autonomy>("auto");
  /** Set when the dial loop gives up, so the UI can explain instead of spinning. */
  const [diagnosis, setDiagnosis] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const idxRef = useRef(0);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const sentAtRef = useRef<Record<string, number>>({});
  const pendingRef = useRef<
    Record<string, { resolve: (out: string) => void; reject: (err: Error) => void }>
  >({});
  const manualCloseRef = useRef(false);
  const activeEndpointRef = useRef<BridgeEndpoint | null>(null);
  const lastReasonRef = useRef<string | null>(null);
  /** One automatic LAN sweep per endpoint change, so we never loop forever. */
  const sweptRef = useRef(false);
  /** True once a socket actually opened — a drop then means "reconnect", not "wrong endpoint". */
  const establishedRef = useRef(false);
  /** Consecutive reconnect attempts against the same, previously-working endpoint. */
  const dropRetriesRef = useRef(0);
  /** Heartbeat so a silently dead wss:// socket is noticed instead of hanging. */
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Callers that must re-arm their polling/streams after a reconnect. */
  const subscribersRef = useRef(new Set<() => void>());

  const push = useCallback((kind: LogLine["kind"], text: string) => {
    setLog((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: Date.now(),
          kind,
          text,
        },
        ...prev,
      ].slice(0, MAX_LOG),
    );
  }, []);

  useEffect(() => {
    setEndpoints(loadEndpoints());
    setTargetState(loadTarget());
    setAutonomy(currentAutonomy());
    return onSettingsChange((s) => setAutonomy(s.autonomy));
  }, []);

  const targetRef = useRef("");
  targetRef.current = target;

  /** Guards the one-shot "arm the disabled endpoints" self-heal. */
  const healedRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  connectRef.current = () => {
    if (stoppedRef.current) return;
    // An endpoint with no URL can never answer — never burn a dial slot on it.
    const active = endpoints.filter((e) => {
      if (!e.enabled || !e.url.trim()) return false;
      return !(
        isBlockedWs(e.url)
      );
    });
    if (active.length === 0) {
      // Self-heal once: a stored config with everything switched off used to
      // dead-end here. Arm any endpoint this page is actually allowed to dial.
      const secure = typeof window !== "undefined" && window.location.protocol === "https:";
      const dialable = endpoints.filter(
        (e) => e.url.trim() && (!secure || e.url.startsWith("wss://")),
      );
      if (!healedRef.current && dialable.length > 0) {
        healedRef.current = true;
        const next = endpoints.map((e) =>
          dialable.some((d) => d.id === e.id) ? { ...e, enabled: true } : e,
        );
        push("sys", `enabling ${dialable.map((e) => e.label).join(", ")} — nothing was armed`);
        saveEndpoints(next);
        setEndpoints(next); // the effect below restarts the dial loop
        return;
      }
      setState("offline");
      const hasBlockedLocal = endpoints.some((e) => isBlockedWs(e.url));
      const why = hasBlockedLocal
        ? "hosted HTTPS cannot open a local ws:// agent — run the local watch deploy, or configure a trusted wss:// endpoint in ⚙"
        : "no bridge endpoint is enabled — configure a local agent or wss:// relay in ⚙";
      setDiagnosis(why);
      push("err", why);
      return;
    }
    const target = active[idxRef.current % active.length]!;
    activeEndpointRef.current = target;
    setActiveId(target.id);
    setState("connecting");
    push("sys", `dialing ${target.label} — ${target.url}`);

    let socket: WebSocket;
    try {
      socket = new WebSocket(target.url);
    } catch {
      advance(`cannot open ${target.label}`);
      return;
    }
    socketRef.current = socket;

    const openTimeout = setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) socket.close();
    }, 4000);

    socket.onopen = () => {
      clearTimeout(openTimeout);
      attemptsRef.current = 0;
      lastReasonRef.current = null;
      setDiagnosis(null);
      establishedRef.current = true;

      setState("agent");
      push("sys", `agent link up via ${target.label}`);
      const hello: OutFrame = {
        type: "hello",
        client: "apex-watch",
        ...(target.token ? { token: target.token } : {}),
      };
      socket.send(JSON.stringify(hello));
      startHeartbeat();
    };

    socket.onmessage = (event) => {
      const frame = parseFrame(String(event.data));
      if (!frame) {
        push("out", String(event.data));
        return;
      }
      handleFrame(frame);
    };

    socket.onerror = () => {
      setState("failing");
      push("err", `WebSocket failed for ${target.url}`);
    };

    socket.onclose = () => {
      clearTimeout(openTimeout);
      stopHeartbeat();
      if (socketRef.current === socket) socketRef.current = null;
      for (const [id, waiter] of Object.entries(pendingRef.current)) {
        delete pendingRef.current[id];
        waiter.reject(new Error("bridge agent disconnected"));
      }
      if (stoppedRef.current || manualCloseRef.current) {
        manualCloseRef.current = false;
        return;
      }
      // A socket that was genuinely up (typically the wss:// agent going away
      // for a moment) is worth redialling as-is instead of failing over.
      if (establishedRef.current) {
        reconnectSame(`${target.label} dropped`);
        return;
      }
      advance(`${target.label} dropped`);
    };
  };

  /** Max fast reconnects to the same endpoint before falling back to failover. */
  const MAX_DROP_RETRIES = 6;

  function reconnectSame(reason: string) {
    establishedRef.current = false;
    setState("failing");
    dropRetriesRef.current += 1;
    if (dropRetriesRef.current > MAX_DROP_RETRIES) {
      dropRetriesRef.current = 0;
      advance(`${reason} — giving up on this endpoint`);
      return;
    }
    const delay = Math.min(500 * 2 ** (dropRetriesRef.current - 1), 15000);
    push(
      "sys",
      `${reason} — reconnecting in ${Math.round(delay / 100) / 10}s (try ${dropRetriesRef.current})`,
    );
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => connectRef.current(), delay);
  }

  function stopHeartbeat() {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
  }

  /**
   * Ping the agent periodically; a socket that stops answering (dead 4G/Wi-Fi
   * NAT, agent killed) is closed so the reconnect path takes over.
   */
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatRef.current = setInterval(() => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const id = `hb-${Date.now().toString(36)}`;
      let answered = false;
      pendingRef.current[id] = {
        resolve: () => {
          answered = true;
        },
        reject: () => {
          answered = true;
        },
      };
      socket.send(JSON.stringify({ type: "devices", id } satisfies OutFrame));
      setTimeout(() => {
        if (!answered && pendingRef.current[id]) {
          delete pendingRef.current[id];
          push("err", "heartbeat timed out — resetting the bridge socket");
          socket.close();
        }
      }, 8000);
    }, 20000);
  }

  const handleFrame = useCallback(
    (frame: InFrame) => {
      if (frame.type === "hello") {
        push("sys", `agent ${frame.agent ?? "?"} adb ${frame.adb ?? "?"}`);
        if (!frame.adb || frame.adb === "?") {
          setState("agent");
          push("err", "agent is running but adb is not installed or not on PATH");
          return;
        }
        const socket = socketRef.current;
        const connectTarget = targetRef.current;
        if (socket?.readyState === WebSocket.OPEN && connectTarget) {
          const connect: OutFrame = {
            type: "connect",
            id: `connect-${Date.now().toString(36)}`,
            target: connectTarget,
          };
          socket.send(JSON.stringify(connect));
          push("sent", `adb connect ${connectTarget}`);
        } else if (!connectTarget) {
          setState("agent");
          push("err", "agent connected — enter the phone Wireless debugging IP and connect port");
        }
        return;
      }
      if (frame.type === "paired") {
        const waiter = pendingRef.current[frame.id];
        if (waiter) {
          delete pendingRef.current[frame.id];
          if (frame.ok) waiter.resolve(frame.output);
          else waiter.reject(new Error(frame.output.trim() || "pairing failed"));
        }
        push(frame.ok ? "sys" : "err", frame.output.trim() || `pair ${frame.target}`);
        return;
      }
      if (frame.type === "connected") {
        setState(frame.ok ? "online" : "agent");
        // The agent may have found a rotated wireless-debugging port; adopt it
        // so the saved address stays valid after an off/on toggle.
        if (frame.ok && frame.target && frame.target !== targetRef.current) {
          targetRef.current = frame.target;
          setTargetState(frame.target);
          saveTarget(frame.target);
          push("sys", `adb address updated to ${frame.target}`);
        }
        if (frame.ok) {
          // Link is fully back: clear the reconnect budget and let every live
          // panel re-arm its polling against the new socket.
          dropRetriesRef.current = 0;
          for (const fn of subscribersRef.current) {
            try {
              fn();
            } catch {
              /* a bad subscriber must not break the link */
            }
          }
        }

        const waiter = pendingRef.current[frame.id];
        if (waiter) {
          delete pendingRef.current[frame.id];
          if (frame.ok) waiter.resolve(frame.output);
          else waiter.reject(new Error(frame.output.trim() || "ADB connect failed"));
        }
        push(
          frame.ok ? "sys" : "err",
          frame.output.trim() ||
            (frame.ok
              ? `connected ${frame.target}`
              : "ADB rejected the address — Wireless debugging may have rotated the connect port"),
        );
        return;
      }
      if (frame.type === "devices") {
        const list = frame.devices.map((d) => `${d.serial} ${d.state}`).join("\n") || "no devices";
        const waiter = pendingRef.current[frame.id];
        if (waiter) {
          delete pendingRef.current[frame.id];
          waiter.resolve(list);
          return;
        }
        push("out", list);
        return;
      }
      if (frame.type === "result") {
        const started = sentAtRef.current[frame.id];
        if (started) {
          setLatency(Date.now() - started);
          delete sentAtRef.current[frame.id];
        }
        const waiter = pendingRef.current[frame.id];
        if (waiter) {
          delete pendingRef.current[frame.id];
          if (frame.ok) waiter.resolve(frame.output);
          else waiter.reject(new Error(frame.output.trim() || "command failed"));
          return;
        }
        push(
          frame.ok ? "out" : "err",
          frame.output.trim() || (frame.ok ? "(no output)" : "command failed"),
        );
        return;
      }
      if (frame.id && pendingRef.current[frame.id]) {
        const waiter = pendingRef.current[frame.id]!;
        delete pendingRef.current[frame.id];
        waiter.reject(new Error(frame.message));
        return;
      }
      if (/bad token/i.test(frame.message)) {
        push("err", `agent rejected token for ${activeEndpointRef.current?.label ?? "endpoint"}`);
      } else {
        push("err", frame.message);
      }
    },
    [push],
  );

  /**
   * Give up after every endpoint has been swept this many times. An endless
   * dial loop burns the watch battery and hides the real reason (blocked
   * ws:// on HTTPS, agent not running, wrong port), so we stop and say why.
   */
  const MAX_CYCLES = 3;

  /**
   * Last resort when every configured endpoint refused: probe the hosts we
   * genuinely know about (phone target host, page host, their /24) and rewrite
   * the endpoint list with the first real agent found.
   */
  const autoDiscover = useCallback(async () => {
    const candidates = buildCandidates(endpoints, targetRef.current);
    if (candidates.length === 0) return;
    push("sys", `auto-discovery: probing ${candidates.length} addresses on this network`);
    const hits = await discoverAgents(candidates.slice(0, 520), () => {}, undefined, 32, 900);
    const hit = hits[0];
    if (!hit) {
      push("err", "auto-discovery found no agent — start adb-bridge-agent.mjs on the phone or PC");
      setDiagnosis("no agent is listening on port 8787 anywhere on this network");
      return;
    }
    push("sys", `found ${hit.agent} at ${hit.host} (${hit.ms} ms) — switching to it`);
    const next = [
      {
        id: "discovered",
        kind: "server" as const,
        label: `Discovered agent (${hit.host})`,
        url: hit.url,
        enabled: true,
      },
      ...endpoints.filter((e) => e.url !== hit.url),
    ];
    saveEndpoints(next);
    setEndpoints(next); // restarts the dial loop through the effect below
  }, [endpoints, push]);

  function advance(reason: string) {
    // Don't repeat the same failure line on every sweep.
    if (lastReasonRef.current !== reason) {
      lastReasonRef.current = reason;
      push("err", reason);
    }
    setState("failing");
    attemptsRef.current += 1;
    idxRef.current += 1;
    const enabledCount =
      endpoints.filter((e) => {
        if (!e.enabled || !e.url.trim()) return false;
        return !(
          isBlockedWs(e.url)
        );
      }).length || 1;
    const cycles = Math.floor(attemptsRef.current / enabledCount);

    if (cycles >= MAX_CYCLES) {
      stoppedRef.current = true;
      setState("offline");
      // Rather than redial the same dead hosts, sweep the LAN once and adopt
      // whatever agent actually answers.
      if (!sweptRef.current && !insecureBlocked()) {
        sweptRef.current = true;
        void autoDiscover();
      }
      const why =
        endpoints.some((e) => e.enabled && isBlockedWs(e.url))
          ? "hosted HTTPS cannot open a local ws:// agent — run the local watch deploy, or configure a trusted wss:// endpoint"
          : "no agent answered — start adb-bridge-agent.mjs and check the host, port and token in ⚙";
      setDiagnosis(why);
      push("sys", `stopped after ${MAX_CYCLES} sweeps · ${why}`);
      return;
    }

    // Fast hop between endpoints, backoff once every endpoint has been tried.
    const delay = cycles === 0 ? 400 : Math.min(1000 * 2 ** cycles, 15000);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => connectRef.current(), delay);
  }

  // (Re)start the connection loop whenever the endpoint list changes.
  useEffect(() => {
    if (endpoints.length === 0) return;
    // Standalone mode (or a screen with no operator package): no dialling.
    if (autonomy === "standalone" || !enabled) {
      stoppedRef.current = true;
      socketRef.current?.close();
      socketRef.current = null;
      setState("offline");
      setActiveId(null);
      return;
    }
    stoppedRef.current = false;
    idxRef.current = 0;
    attemptsRef.current = 0;
    sweptRef.current = false;
    healedRef.current = false;
    establishedRef.current = false;
    dropRetriesRef.current = 0;
    lastReasonRef.current = null;
    setDiagnosis(null);
    connectRef.current();

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      stopHeartbeat();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [endpoints, autonomy, enabled]);

  /**
   * Reconnect as soon as the environment says it can work again: the radio
   * came back, or the watch screen woke with a dead socket behind it.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wake = () => {
      if (autonomy === "standalone" || !enabled) return;
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      stoppedRef.current = false;
      dropRetriesRef.current = 0;
      attemptsRef.current = 0;
      lastReasonRef.current = null;
      connectRef.current();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") wake();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [autonomy, enabled]);

  /**
   * Register work that must be re-run every time the link comes back up
   * (re-arm pollers, re-open logcat streams). Returns an unsubscribe.
   */
  const subscribe = useCallback((fn: () => void) => {
    subscribersRef.current.add(fn);
    return () => {
      subscribersRef.current.delete(fn);
    };
  }, []);

  const send = useCallback(
    (cmd: string) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        push("err", "no link — command queued nowhere");
        return;
      }
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      sentAtRef.current[id] = Date.now();
      const frame: OutFrame =
        cmd === "adb devices -l"
          ? { type: "devices", id }
          : { type: "shell", id, cmd, ...(targetRef.current ? { serial: targetRef.current } : {}) };
      socket.send(JSON.stringify(frame));
      push("sent", cmd);
    },
    [push],
  );

  /**
   * Run a command and resolve with its real stdout. Rejects when there is no
   * live agent — callers must render "no source" rather than invent data.
   */
  const run = useCallback((cmd: string, timeoutMs = 12000) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("no bridge link"));
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    sentAtRef.current[id] = Date.now();
    const frame: OutFrame =
      cmd === "adb devices -l"
        ? { type: "devices", id }
        : { type: "shell", id, cmd, ...(targetRef.current ? { serial: targetRef.current } : {}) };
    return new Promise<string>((resolve, reject) => {
      pendingRef.current[id] = { resolve, reject };
      socket.send(JSON.stringify(frame));
      setTimeout(() => {
        if (pendingRef.current[id]) {
          delete pendingRef.current[id];
          reject(new Error("command timed out"));
        }
      }, timeoutMs);
    });
  }, []);

  const request = useCallback((frame: OutFrame, timeoutMs = 25000) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !("id" in frame)) {
      return Promise.reject(new Error("no bridge agent link"));
    }
    return new Promise<string>((resolve, reject) => {
      pendingRef.current[frame.id] = { resolve, reject };
      socket.send(JSON.stringify(frame));
      setTimeout(() => {
        if (pendingRef.current[frame.id]) {
          delete pendingRef.current[frame.id];
          reject(new Error("ADB request timed out"));
        }
      }, timeoutMs);
    });
  }, []);

  /**
   * Wireless debugging picks a new port every time it is toggled off/on, so
   * this asks the agent to rediscover the device over mDNS and adopt whatever
   * host:port it is advertising right now.
   */
  const findDevice = useCallback(() => {
    const id = `find-${Date.now().toString(36)}`;
    const host = targetRef.current.split(":")[0]?.trim();
    push("sent", "adb mdns services — finding rotated port");
    return request({ type: "autoconnect", id, ...(host ? { host } : {}) }, 30000);
  }, [push, request]);

  const connectDevice = useCallback(
    async (nextTarget = targetRef.current) => {
      const clean = nextTarget.trim();
      if (!clean) return findDevice();
      const id = `connect-${Date.now().toString(36)}`;
      push("sent", `adb connect ${clean}`);
      try {
        return await request({ type: "connect", id, target: clean });
      } catch (error) {
        // Stale port after a Wireless-debugging toggle: rediscover instead of
        // making the operator read the new number off the phone.
        push("sys", "saved port refused — searching for the new one");
        try {
          return await findDevice();
        } catch {
          throw error;
        }
      }
    },
    [findDevice, push, request],
  );

  const pairDevice = useCallback(
    (pairTarget: string, code: string) => {
      const cleanTarget = pairTarget.trim();
      const cleanCode = code.trim();
      if (!cleanTarget || !/^\d{6}$/.test(cleanCode)) {
        return Promise.reject(new Error("enter the pairing IP & port and 6-digit code"));
      }
      const id = `pair-${Date.now().toString(36)}`;
      push("sent", `adb pair ${cleanTarget}`);
      return request({ type: "pair", id, target: cleanTarget, code: cleanCode });
    },
    [push, request],
  );

  /** Ask the trusted local agent to fetch/install the fixed upstream bundle. */
  const bootstrapAssembly = useCallback(() => {
    const id = `assembly-${Date.now().toString(36)}`;
    push("sent", "prepare full assembly");
    return request(
      { type: "assembly", id, ...(targetRef.current ? { serial: targetRef.current } : {}) },
      600000,
    );
  }, [push, request]);

  const retryNow = useCallback(() => {
    manualCloseRef.current = true;
    socketRef.current?.close();
    if (timerRef.current) clearTimeout(timerRef.current);
    // A tap on the status line is an explicit "try again": clear the halt.
    stoppedRef.current = false;
    lastReasonRef.current = null;
    setDiagnosis(null);
    attemptsRef.current = 0;
    idxRef.current = 0;
    sweptRef.current = false;
    healedRef.current = false;
    establishedRef.current = false;
    dropRetriesRef.current = 0;
    connectRef.current();
  }, []);

  const stateRef = useRef<LinkState>("idle");
  stateRef.current = state;
  const diagnosisRef = useRef<string | null>(null);
  diagnosisRef.current = diagnosis;

  /**
   * One-button link-up for non-technical operators: clear any halt, redial
   * every endpoint, and if nothing answers, sweep the LAN for a live agent.
   * Once up, the existing heartbeat + reconnect logic keeps it fed until the
   * operator taps disconnect.
   */
  const autoLink = useCallback(async () => {
    stoppedRef.current = false;
    manualCloseRef.current = true;
    socketRef.current?.close();
    socketRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    lastReasonRef.current = null;
    setDiagnosis(null);
    diagnosisRef.current = null;
    attemptsRef.current = 0;
    idxRef.current = 0;
    sweptRef.current = false;
    healedRef.current = false;
    establishedRef.current = false;
    dropRetriesRef.current = 0;
    push("sys", "one-tap link: dialing every known agent");
    connectRef.current();

    // Nothing dialable (no endpoints, or https page + ws:// agent): stop now
    // and let the UI explain instead of spinning for 16 seconds.
    if (stateRef.current === "offline" && diagnosisRef.current) return false;

    // Give the direct dials a few seconds, then sweep the network ourselves.
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (stateRef.current === "online") return true;
      if (stoppedRef.current) return false;
    }
    if (!insecureBlocked()) {
      sweptRef.current = true;
      await autoDiscover();
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (stateRef.current === "online") return true;
        if (stoppedRef.current) return false;
      }
      if (stateRef.current !== "online" && !diagnosisRef.current) {
        setDiagnosis(
          "no agent answered on this network — start the bridge agent, or open ⚙ for setup help",
        );
      }
    } else if (!diagnosisRef.current) {
      setDiagnosis(
        "this page is https, so it cannot reach a local ws:// agent — see ⚙ mixed-content help",
      );
    }
    return stateRef.current === "online";
  }, [autoDiscover, push]);

  /** Explicit operator stop: drop the socket and stay down until asked again. */
  const disconnect = useCallback(() => {
    stoppedRef.current = true;
    manualCloseRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    stopHeartbeat();
    socketRef.current?.close();
    socketRef.current = null;
    setState("offline");
    setActiveId(null);
    setDiagnosis("disconnected by operator");
    push("sys", "link stopped by operator");
  }, [push]);

  const clearLog = useCallback(() => setLog([]), []);

  const setTarget = useCallback((next: string) => {
    setTargetState(next.trim());
  }, []);

  return {
    autonomy,
    endpoints,
    setEndpoints,
    target,
    setTarget,
    activeId,
    state,
    diagnosis,
    log,
    latency,
    send,
    run,
    pairDevice,
    connectDevice,
    findDevice,
    bootstrapAssembly,
    retryNow,
    autoLink,
    disconnect,
    clearLog,
    subscribe,
  };
}
