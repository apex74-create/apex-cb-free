/**
 * PTT session machine — one press, one session, one socket cycle.
 *
 * The owner's cadence logic (Nov 12, 2026): the button must be intuitive
 * to the touch. Intent is read from the cadence and the silence window,
 * not from perfect presses — the machine forgives the hand.
 *
 *  - ONE PRESS, ONE SESSION, ARMED WAIT: a press opens exactly one
 *    session — one mic pipeline, one armed wait for the operator's
 *    voice, one transmission on the bus when it closes. A press NEVER
 *    stacks a second session on top of a live one, whatever state the
 *    machine is in: arming joins the open in flight, keyed is already
 *    the session, grace resumes it.
 *  - ACCIDENTAL RELEASE = SAME SESSION: a release is not an ending, it
 *    is a question a timer answers. Release pauses the take and starts
 *    the grace window (TX_GRACE_MS). A re-press inside the window
 *    resumes THE SAME session — same mic, same recording, no new
 *    entrance tone — the way a thumb-slip on a real hand-mic changes
 *    nothing. Where a recording lane rides the session, the take's
 *    unchanged cadence is the continuity proof: slip ≠ new transmission.
 *  - DEFINITIVE RELEASE = TIMING: a release with no re-press behind it
 *    inside TX_GRACE_MS is a send-intent release. Grace expiry stops the
 *    take, the one transmission goes out, the exit tone sounds, the
 *    session closes, the mic is torn down. Nothing is left open.
 *  - DELIBERATE FINISH skips the window: tap-mode's second tap and the
 *    MAX_KEY_MS cap close the session immediately.
 *
 * Entrance tone, exit tone and the TX indicator are slaved to session
 * transitions — onEnter and onExit fire exactly once per session — so
 * the operator's ears, the red light and the actual transmission can
 * never disagree. The tones are his diagnostic instrument for the cycle;
 * this machine is what makes them tell the truth.
 *
 * The bus channel itself is owned by tune() (one channel per tuned
 * room, rejoined by its own logic); this machine owns everything a
 * press creates, and guarantees a press creates it at most once.
 */

/**
 * The silence window that separates a thumb-slip from a send.
 * BENCH-TUNABLE: this is a feel parameter, not doctrine — tune it on
 * the bench against real hands (gloves, cold, a bouncing cab) and
 * change it here, in one place. 1200 ms is long enough to lose a grip,
 * swear, and re-grip; short enough that a real ending still feels
 * like an ending.
 */
export const TX_GRACE_MS = 1200;

/** Session length cap, mirroring MAX_KEY_MS in ptt.ts. */
const SESSION_CAP_MS = 8000;

export type PttSessionState = "idle" | "arming" | "keyed" | "grace";

export type PttMicHandle = {
  start: () => void;
  stop: () => Promise<string | null>;
  close: () => void;
  pause: () => void;
  resume: () => void;
};

export type PttSessionEvents = {
  /** Session is live and recording: entrance tone + TX indicator on. Once per session. */
  onEnter: () => void;
  /** Session has fully closed: exit tone + TX indicator off. Once per session. */
  onExit: () => void;
  /** The session's one transmission, at definitive close. */
  onSend: (body: string) => void;
  /** Definitive close with nothing captured. */
  onEmpty: () => void;
  /** The mic could not be opened; no session exists. */
  onError: (err: unknown) => void;
  onState?: (s: PttSessionState) => void;
};

export type PttSessionOptions = {
  events: PttSessionEvents;
  /** Injectable for the bench; defaults to the real mic pipeline. */
  openMic?: () => Promise<PttMicHandle>;
  /** Override TX_GRACE_MS for a bench run. */
  graceMs?: number;
  /** Override the session cap for a bench run. */
  maxKeyMs?: number;
};

export type PttSession = {
  /** A press edge. Resolves true when a session is (or becomes) live. */
  press: () => Promise<boolean>;
  /** A release edge: starts the grace window; sends nothing by itself. */
  release: () => void;
  /** Definitive close now: second-strike send, or the cap. */
  finish: () => void;
  /** Deck is leaving: tear the session down silently, orphan nothing. */
  dispose: () => void;
  state: () => PttSessionState;
};

async function defaultOpenMic(): Promise<PttMicHandle> {
  const { openMic } = await import("@/lib/ptt");
  return openMic();
}

export function createPttSession(opts: PttSessionOptions): PttSession {
  const { events } = opts;
  const openMicFn = opts.openMic ?? defaultOpenMic;
  const graceMs = opts.graceMs ?? TX_GRACE_MS;
  const maxKeyMs = opts.maxKeyMs ?? SESSION_CAP_MS;

  let state: PttSessionState = "idle";
  let mic: PttMicHandle | null = null;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  let capTimer: ReturnType<typeof setTimeout> | null = null;
  let openPromise: Promise<boolean> | null = null;
  let closingPromise: Promise<void> | null = null;
  let releaseWanted = false;
  let finishWanted = false;
  let disposed = false;

  const setState = (s: PttSessionState) => {
    state = s;
    events.onState?.(s);
  };

  const clearTimers = () => {
    if (graceTimer) clearTimeout(graceTimer);
    if (capTimer) clearTimeout(capTimer);
    graceTimer = null;
    capTimer = null;
  };

  /** Definitive close: stop the take, send it once, exit tone, teardown. */
  const finalize = (): Promise<void> => {
    if (closingPromise) return closingPromise;
    if (state === "idle" || state === "arming") return Promise.resolve();
    closingPromise = (async () => {
      clearTimers();
      const m = mic;
      mic = null;
      let url: string | null = null;
      try {
        url = m ? await m.stop() : null;
      } catch {
        url = null;
      }
      try {
        m?.close();
      } catch {
        /* already down */
      }
      closingPromise = null;
      if (disposed) return;
      setState("idle");
      if (url) events.onSend(url);
      else events.onEmpty();
      events.onExit();
    })();
    return closingPromise;
  };

  const release = () => {
    if (disposed) return;
    if (state === "arming") {
      releaseWanted = true;
      return;
    }
    if (state !== "keyed") return;
    // A release is a question, not an ending: pause the take and let
    // the silence window decide whether that was a slip or a send.
    try {
      mic?.pause();
    } catch {
      /* take runs through the slip */
    }
    setState("grace");
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = setTimeout(() => {
      graceTimer = null;
      void finalize();
    }, graceMs);
  };

  const finish = () => {
    if (disposed) return;
    if (state === "arming") {
      finishWanted = true;
      return;
    }
    if (state === "keyed" || state === "grace") void finalize();
  };

  const press = async (): Promise<boolean> => {
    if (disposed) return false;
    if (closingPromise) {
      // A press landing mid-close waits out the close, then keys fresh.
      await closingPromise;
      return press();
    }
    if (state === "keyed") return true; // already the session — never a second one
    if (state === "arming") return openPromise ?? false; // join the open in flight
    if (state === "grace") {
      // The slip forgiven: same session, same take, no new tone.
      if (graceTimer) clearTimeout(graceTimer);
      graceTimer = null;
      try {
        mic?.resume();
      } catch {
        /* already running */
      }
      setState("keyed");
      return true;
    }
    // Idle: open the one session and arm the wait for his voice.
    setState("arming");
    releaseWanted = false;
    finishWanted = false;
    openPromise = (async () => {
      let m: PttMicHandle;
      try {
        m = await openMicFn();
      } catch (err) {
        openPromise = null;
        if (!disposed) {
          setState("idle");
          events.onError(err);
        }
        return false;
      }
      if (disposed) {
        try {
          m.close();
        } catch {
          /* nothing to tear down */
        }
        openPromise = null;
        return false;
      }
      mic = m;
      m.start();
      setState("keyed");
      events.onEnter();
      capTimer = setTimeout(() => {
        capTimer = null;
        void finalize();
      }, maxKeyMs);
      openPromise = null;
      if (finishWanted) {
        finishWanted = false;
        void finalize();
      } else if (releaseWanted) {
        releaseWanted = false;
        release();
      }
      return true;
    })();
    return openPromise;
  };

  const dispose = () => {
    disposed = true;
    clearTimers();
    const m = mic;
    mic = null;
    if (m) {
      try {
        m.close();
      } catch {
        /* already down */
      }
    }
    state = "idle";
  };

  return { press, release, finish, dispose, state: () => state };
}
