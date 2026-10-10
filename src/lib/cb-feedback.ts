/** Local-only radio cadence. No FX audio is sent over a carrier. */
let context: AudioContext | null = null;
let prestaged = false;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

/**
 * Pre-stage the audio context on the very first user gesture, long before
 * the first key-up. Browsers start an AudioContext "suspended" until a
 * gesture; creating it lazily at the first chirp meant the entrance cadence
 * was swallowed while resume() was still pending — the stall heard in the
 * first Channel 19 field test. Once any pointer or key touches the page,
 * the context is created and resumed so the first beep always sounds.
 */
export function prestageCadenceAudio() {
  if (prestaged || typeof window === "undefined") return;
  prestaged = true;
  const warm = () => {
    audio();
    window.removeEventListener("pointerdown", warm);
    window.removeEventListener("keydown", warm);
  };
  window.addEventListener("pointerdown", warm, { passive: true });
  window.addEventListener("keydown", warm);
}

export function chirp() {
  const ctx = audio();
  if (!ctx) return;
  // Four tiny pitched syllables: beetle-dee-deet.
  [740, 970, 820, 1160].forEach((pitch, i) => {
    const start = ctx.currentTime + i * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, start);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.86, start + 0.07);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.085, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.075);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.08);
  });
}

export function tailStatic() {
  const ctx = audio();
  if (!ctx) return;
  const length = Math.round(ctx.sampleRate * 0.13);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = 1600;
  filter.Q.value = 0.6;
  gain.gain.value = 0.07;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
}

export function tapHaptic(pattern: number | number[] = 12) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}