/**
 * Background keep-alive for the CB deck.
 *
 * Android only keeps a browser tab's audio thread warm while something is
 * playing, and only shows the notification player card for an active media
 * session. A silent looping buffer does both: the receiver keeps running with
 * the screen off or another app in front, and the channel shows up in the
 * notification shade next to the music player.
 *
 * Must be started from a user gesture — autoplay policy blocks it otherwise.
 */

type Handlers = {
  channelUp: () => void;
  channelDown: () => void;
  monitor: (on: boolean) => void;
};

let ctx: AudioContext | null = null;
let src: AudioBufferSourceNode | null = null;
let el: HTMLAudioElement | null = null;

export function mediaSessionSupported(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

/** Silent 1-second loop — enough for Android to treat us as a live player. */
function silentLoop(context: AudioContext) {
  const buf = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const node = context.createBufferSource();
  node.buffer = buf;
  node.loop = true;
  const gain = context.createGain();
  gain.gain.value = 0.0001;
  node.connect(gain).connect(context.destination);
  node.start();
  return node;
}

export async function startKeepAlive(h: Handlers): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    if (!src) src = silentLoop(ctx);

    // An <audio> element is what surfaces the notification card on Android.
    if (!el) {
      el = document.createElement("audio");
      el.loop = true;
      el.volume = 0.0001;
      // 1-frame silent wav, inline so nothing has to be fetched.
      el.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
    }
    await el.play().catch(() => {});

    if (mediaSessionSupported()) {
      const ms = navigator.mediaSession;
      ms.playbackState = "playing";
      const set = (a: MediaSessionAction, fn: () => void) => {
        try {
          ms.setActionHandler(a, fn);
        } catch {
          /* action unsupported on this browser */
        }
      };
      set("play", () => h.monitor(true));
      set("pause", () => h.monitor(false));
      set("nexttrack", h.channelUp);
      set("previoustrack", h.channelDown);
    }
    return true;
  } catch {
    return false;
  }
}

/** Update the line shown in the notification player. */
export function setKeepAliveInfo(channel: string, line: string) {
  if (!mediaSessionSupported()) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `CH ${channel}`,
      artist: line,
      album: "Sovereign CB",
      artwork: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  } catch {
    /* metadata unsupported */
  }
}

export function stopKeepAlive() {
  try {
    src?.stop();
  } catch {
    /* already stopped */
  }
  src = null;
  if (el) {
    el.pause();
    el.remove();
    el = null;
  }
  void ctx?.close();
  ctx = null;
  if (mediaSessionSupported()) {
    try {
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.metadata = null;
    } catch {
      /* ignore */
    }
  }
}
