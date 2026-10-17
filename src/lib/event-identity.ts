export const RECENT_EVENTS_KEY = 'apex.mesh.recent-events';
const VALID_CODE = /^[a-z0-9-]{3,40}$/;

export function recentEventCodes(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_EVENTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string' && VALID_CODE.test(value)).slice(0, 8) : [];
  } catch { return []; }
}

export function rememberEvent(code: string) {
  if (!VALID_CODE.test(code)) return;
  try { localStorage.setItem(RECENT_EVENTS_KEY, JSON.stringify([code, ...recentEventCodes().filter(value => value !== code)].slice(0, 8))); }
  catch { /* Browsing still works when storage is disabled. */ }
}

/** Sample a small, permitted image for a muted handset rim. Cross-origin images
 * without CORS cannot be read; keep the standard mesh tint in that case. */
export function imageRimColor(url: string, apply: (color: string | null) => void): () => void {
  let live = true;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    if (!live) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 24; canvas.height = 24;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, 24, 24);
      const pixels = ctx.getImageData(0, 0, 24, 24).data;
      let red = 0, green = 0, blue = 0, weight = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] ?? 0, g = pixels[i + 1] ?? 0, b = pixels[i + 2] ?? 0, alpha = pixels[i + 3] ?? 0;
        const brightness = (r + g + b) / 3;
        if (alpha < 128 || brightness < 18 || brightness > 240) continue;
        const w = Math.max(1, (Math.max(r, g, b) - Math.min(r, g, b)) / 30);
        red += r * w; green += g * w; blue += b * w; weight += w;
      }
      if (weight && live) apply(`rgb(${Math.round(red / weight)} ${Math.round(green / weight)} ${Math.round(blue / weight)})`);
    } catch { /* No cross-origin pixel access: use the standard mesh rim. */ }
  };
  image.onerror = () => { if (live) apply(null); };
  image.src = url;
  return () => { live = false; image.onload = null; image.onerror = null; };
}