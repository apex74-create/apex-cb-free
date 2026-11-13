/**
 * Rapid-keying bench for the PTT session machine (ptt-session.ts).
 *
 * The field bug (owner report, Nov 12, 2026): a double-tap "break"
 * stacked sessions — sockets on sockets — until the TX light, the
 * entrance/exit tones and the actual transmission disagreed. The
 * owner's cure is cadence: one press, one session; a slip inside the
 * grace window is the same session; only silence closes it.
 *
 * These tests script the hand: double-tap, triple-tap, press-while-
 * keyed, release-during-arming, tap-during-grace — and count what the
 * machine creates. Socket discipline here = session discipline: one
 * mic pipeline opened, one entrance tone, one transmission, one exit
 * tone, per session, however rough the keying gets.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPttSession, TX_GRACE_MS, type PttMicHandle } from "./ptt-session";

const GRACE = 1000;
const CAP = 8000;

type Counters = {
  opens: number;
  starts: number;
  stops: number;
  closes: number;
  pauses: number;
  resumes: number;
  enters: number;
  exits: number;
  sends: string[];
  empties: number;
  errors: number;
};

function harness(openDelayMs = 0) {
  const c: Counters = {
    opens: 0,
    starts: 0,
    stops: 0,
    closes: 0,
    pauses: 0,
    resumes: 0,
    enters: 0,
    exits: 0,
    sends: [],
    empties: 0,
    errors: 0,
  };
  const openMic = (): Promise<PttMicHandle> => {
    c.opens++;
    const handle: PttMicHandle = {
      start: () => {
        c.starts++;
      },
      stop: () => {
        c.stops++;
        return Promise.resolve("data:audio/webm;base64,CLIP");
      },
      close: () => {
        c.closes++;
      },
      pause: () => {
        c.pauses++;
      },
      resume: () => {
        c.resumes++;
      },
    };
    if (openDelayMs > 0) {
      return new Promise((res) => setTimeout(() => res(handle), openDelayMs));
    }
    return Promise.resolve(handle);
  };
  const session = createPttSession({
    graceMs: GRACE,
    maxKeyMs: CAP,
    openMic,
    events: {
      onEnter: () => {
        c.enters++;
      },
      onExit: () => {
        c.exits++;
      },
      onSend: (b) => {
        c.sends.push(b);
      },
      onEmpty: () => {
        c.empties++;
      },
      onError: () => {
        c.errors++;
      },
    },
  });
  return { c, session };
}

/** Let queued microtasks (open/finalize chains) settle without moving time. */
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("one press, one session", () => {
  it("a plain hold-and-release opens once and sends once, after the grace window", async () => {
    const { c, session } = harness();
    await session.press();
    expect(session.state()).toBe("keyed");
    session.release();
    expect(session.state()).toBe("grace");
    // Inside the window nothing has been sent and nothing has closed.
    await vi.advanceTimersByTimeAsync(GRACE - 1);
    expect(c.sends).toHaveLength(0);
    expect(c.exits).toBe(0);
    // Silence past the window = definitive release.
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(c.opens).toBe(1);
    expect(c.enters).toBe(1);
    expect(c.sends).toHaveLength(1);
    expect(c.exits).toBe(1);
    expect(c.closes).toBe(1);
    expect(session.state()).toBe("idle");
  });

  it("double-tap break: slip inside grace is the SAME session", async () => {
    const { c, session } = harness();
    await session.press();
    session.release(); // thumb comes off — a break attempt begins
    await vi.advanceTimersByTimeAsync(300); // still inside the window
    await session.press(); // re-press: resume, never a new session
    expect(session.state()).toBe("keyed");
    expect(c.opens).toBe(1);
    expect(c.enters).toBe(1); // no second entrance tone
    expect(c.pauses).toBe(1);
    expect(c.resumes).toBe(1);
    session.release();
    await vi.advanceTimersByTimeAsync(GRACE);
    await settle();
    expect(c.opens).toBe(1); // one socket cycle for the whole rough ride
    expect(c.starts).toBe(1);
    expect(c.sends).toHaveLength(1); // one transmission, not two
    expect(c.exits).toBe(1);
    expect(c.closes).toBe(1);
  });

  it("triple-tap volley: three presses, three releases, still one session", async () => {
    const { c, session } = harness();
    await session.press();
    for (let i = 0; i < 2; i++) {
      session.release();
      await vi.advanceTimersByTimeAsync(200);
      await session.press();
    }
    session.release();
    await vi.advanceTimersByTimeAsync(GRACE);
    await settle();
    expect(c.opens).toBe(1);
    expect(c.enters).toBe(1);
    expect(c.sends).toHaveLength(1);
    expect(c.exits).toBe(1);
  });

  it("a press while already keyed is absorbed — never a second session", async () => {
    const { c, session } = harness();
    await session.press();
    await session.press();
    await session.press();
    expect(c.opens).toBe(1);
    expect(c.enters).toBe(1);
    session.release();
    await vi.advanceTimersByTimeAsync(GRACE);
    await settle();
    expect(c.sends).toHaveLength(1);
    expect(c.exits).toBe(1);
  });

  it("a second press while the mic is still opening joins the same open", async () => {
    const { c, session } = harness(500);
    const p1 = session.press();
    const p2 = session.press();
    await vi.advanceTimersByTimeAsync(500);
    await expect(p1).resolves.toBe(true);
    await expect(p2).resolves.toBe(true);
    expect(c.opens).toBe(1);
    expect(c.enters).toBe(1);
    session.release();
    await vi.advanceTimersByTimeAsync(GRACE);
    await settle();
    expect(c.sends).toHaveLength(1);
  });

  it("a release that lands while the mic is opening still closes cleanly, once", async () => {
    const { c, session } = harness(500);
    const p = session.press();
    session.release(); // finger already off before the mic exists
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toBe(true);
    // The release was remembered: the fresh session went straight to grace.
    expect(session.state()).toBe("grace");
    await vi.advanceTimersByTimeAsync(GRACE);
    await settle();
    expect(c.opens).toBe(1);
    expect(c.enters).toBe(1);
    expect(c.sends).toHaveLength(1);
    expect(c.exits).toBe(1);
    expect(c.closes).toBe(1);
  });
});

describe("definitive closes", () => {
  it("finish() inside the grace window sends immediately, skipping the wait", async () => {
    const { c, session } = harness();
    await session.press();
    session.release();
    session.finish(); // tap-mode second tap: a deliberate ending
    await settle();
    expect(c.sends).toHaveLength(1);
    expect(c.exits).toBe(1);
    expect(session.state()).toBe("idle");
    // Nothing lurks behind it.
    await vi.advanceTimersByTimeAsync(GRACE * 3);
    expect(c.sends).toHaveLength(1);
    expect(c.opens).toBe(1);
  });

  it("the session cap closes a keyed session at MAX_KEY even with no release", async () => {
    const { c, session } = harness();
    await session.press();
    await vi.advanceTimersByTimeAsync(CAP);
    await settle();
    expect(c.sends).toHaveLength(1);
    expect(c.exits).toBe(1);
    expect(c.closes).toBe(1);
    expect(session.state()).toBe("idle");
  });

  it("two full transmissions back to back are two sessions — never one merged, never stacked", async () => {
    const { c, session } = harness();
    await session.press();
    session.release();
    await vi.advanceTimersByTimeAsync(GRACE);
    await settle();
    await session.press();
    session.release();
    await vi.advanceTimersByTimeAsync(GRACE);
    await settle();
    expect(c.opens).toBe(2);
    expect(c.enters).toBe(2);
    expect(c.sends).toHaveLength(2);
    expect(c.exits).toBe(2);
  });
});

describe("teardown", () => {
  it("dispose during grace closes the mic and sends nothing, ever", async () => {
    const { c, session } = harness();
    await session.press();
    session.release();
    session.dispose();
    expect(c.closes).toBe(1);
    await vi.advanceTimersByTimeAsync(GRACE * 5);
    await settle();
    expect(c.sends).toHaveLength(0);
    expect(c.exits).toBe(0);
    expect(session.state()).toBe("idle");
  });

  it("dispose mid-key tears down with no orphan mic and no late send", async () => {
    const { c, session } = harness();
    await session.press();
    session.dispose();
    await vi.advanceTimersByTimeAsync(CAP * 2);
    await settle();
    expect(c.closes).toBe(1);
    expect(c.sends).toHaveLength(0);
  });

  it("a mic that refuses to open reports the error and leaves no session behind", async () => {
    const c = { errors: 0, enters: 0 };
    const session = createPttSession({
      graceMs: GRACE,
      openMic: () => Promise.reject(new Error("denied")),
      events: {
        onEnter: () => {
          c.enters++;
        },
        onExit: () => {},
        onSend: () => {},
        onEmpty: () => {},
        onError: () => {
          c.errors++;
        },
      },
    });
    await expect(session.press()).resolves.toBe(false);
    expect(c.errors).toBe(1);
    expect(c.enters).toBe(0);
    expect(session.state()).toBe("idle");
  });

  it("TX_GRACE_MS is a named, positive default — a tunable, not a magic number", () => {
    expect(TX_GRACE_MS).toBeGreaterThan(0);
    expect(TX_GRACE_MS).toBeLessThan(CAP);
  });
});
