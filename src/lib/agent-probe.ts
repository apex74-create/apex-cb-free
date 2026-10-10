/**
 * Companion worker handshake.
 *
 * A real WebSocket is opened to the candidate agent, a `hello` frame is sent
 * and the agent's `hello` reply is awaited. Anything else — a socket that
 * opens but never answers, a plain HTTP server, a TLS mismatch — is reported
 * as a *reason*, not a silent null, so the troubleshooting panel can tell the
 * operator what actually went wrong.
 *
 * Every attempt is bounded by a timeout and the whole probe retries with
 * linear backoff, because a freshly started agent often loses the first dial.
 */

import { isBlockedWs, parseFrame } from "./bridge";

export type ProbeFailure =
  | "blocked" // mixed content: HTTPS page cannot open ws://
  | "bad-url"
  | "refused" // socket never opened
  | "timeout" // opened (or not) but no hello inside the window
  | "not-agent" // something answered, but not our protocol
  | "unauthorized"; // agent answered but requires the configured token

export type ProbeAttempt = {
  attempt: number;
  url: string;
  ok: boolean;
  ms: number;
  failure?: ProbeFailure;
  agent?: string;
  adb?: string | null;
  detail?: string;
};

export type ProbeResult = {
  url: string;
  ok: boolean;
  attempts: ProbeAttempt[];
  agent?: string;
  adb?: string | null;
  ms?: number;
  failure?: ProbeFailure;
  /** Plain-language explanation shown to the operator. */
  advice: string;
};

const REASON: Record<ProbeFailure, string> = {
  blocked:
    "This page is HTTPS, so the browser refuses plain ws:// links. Use a wss:// agent or open the app over http://.",
  "bad-url": "That address is not a valid WebSocket URL. Expected ws://host:port/path.",
  refused:
    "Nothing is listening there. Start the companion worker on that host and port, and check the firewall.",
  timeout:
    "The socket opened but the agent never answered. Wrong port, wrong path, or the worker is wedged.",
  "not-agent":
    "Something answered but it is not the Apex agent. Another service is using that port.",
  unauthorized: "The agent answered but rejected the token. Use the token shown by the agent at startup.",
};

export function isWsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "ws:" || u.protocol === "wss:") && !!u.hostname;
  } catch {
    return false;
  }
}

function mixedBlocked(url: string): boolean {
  return isBlockedWs(url);
}

/** Single bounded handshake attempt. */
export function probeOnce(url: string, timeoutMs = 3000, attempt = 1, token = ""): Promise<ProbeAttempt> {
  const started = Date.now();
  const fail = (failure: ProbeFailure, detail?: string): ProbeAttempt => ({
    attempt,
    url,
    ok: false,
    ms: Date.now() - started,
    failure,
    ...(detail ? { detail } : {}),
  });

  if (!isWsUrl(url)) return Promise.resolve(fail("bad-url"));
  if (mixedBlocked(url)) return Promise.resolve(fail("blocked"));

  return new Promise<ProbeAttempt>((resolve) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (error) {
      resolve(fail("refused", error instanceof Error ? error.message : undefined));
      return;
    }

    let opened = false;
    let settled = false;
    const finish = (value: ProbeAttempt) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* already closing */
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(fail(opened ? "timeout" : "refused")), timeoutMs);

    socket.onopen = () => {
      opened = true;
      socket.send(JSON.stringify({ type: "hello", client: "apex-watch", ...(token ? { token } : {}) }));
    };
    socket.onerror = () => finish(fail(opened ? "timeout" : "refused"));
    socket.onclose = () => finish(fail(opened ? "not-agent" : "refused"));
    socket.onmessage = (event) => {
      const frame = parseFrame(String(event.data));
      if (!frame) return;
      if (frame.type === "error" && /token|unauthenticated/i.test(frame.message)) {
        finish(fail("unauthorized"));
        return;
      }
      if (frame.type !== "hello") {
        finish(fail("not-agent", frame.type));
        return;
      }
      finish({
        attempt,
        url,
        ok: true,
        ms: Date.now() - started,
        agent: frame.agent ?? "agent",
        adb: frame.adb ?? null,
      });
    };
  });
}

/** Handshake with retry + linear backoff. Stops early on unrecoverable failures. */
export async function probeWithRetry(
  url: string,
  opts: {
    timeoutMs?: number;
    retries?: number;
    backoffMs?: number;
    onAttempt?: (attempt: ProbeAttempt) => void;
    signal?: AbortSignal;
    token?: string;
  } = {},
): Promise<ProbeResult> {
  const { timeoutMs = 3000, retries = 2, backoffMs = 700, onAttempt, signal, token = "" } = opts;
  const attempts: ProbeAttempt[] = [];

  for (let i = 1; i <= retries + 1; i++) {
    if (signal?.aborted) break;
    const attempt = await probeOnce(url, timeoutMs, i, token);
    attempts.push(attempt);
    onAttempt?.(attempt);
    if (attempt.ok) {
      return {
        url,
        ok: true,
        attempts,
        ...(attempt.agent ? { agent: attempt.agent } : {}),
        adb: attempt.adb ?? null,
        ms: attempt.ms,
        advice: `Agent ${attempt.agent} answered in ${attempt.ms}ms${attempt.adb ? ` · adb ${attempt.adb}` : ""}.`,
      };
    }
    // Retrying a blocked or malformed URL can never succeed.
    if (attempt.failure === "blocked" || attempt.failure === "bad-url" || attempt.failure === "unauthorized") break;
    if (i <= retries && !signal?.aborted) {
      await new Promise((r) => setTimeout(r, backoffMs * i));
    }
  }

  const last = attempts[attempts.length - 1];
  const failure = last?.failure ?? "refused";
  return { url, ok: false, attempts, failure, advice: REASON[failure] };
}

export function failureText(failure: ProbeFailure): string {
  return REASON[failure];
}
