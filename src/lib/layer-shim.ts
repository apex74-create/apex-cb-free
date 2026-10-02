/**
 * Cascade-layer shim for legacy WebViews (LOKMAT watch, old Android Chrome).
 *
 * Tailwind v4 emits every rule inside `@layer theme/base/utilities`. Browsers
 * older than Chrome 99 do not understand `@layer`, so they drop the entire
 * block and the app renders as unstyled HTML. This fetches the stylesheets,
 * strips the layer wrappers (keeping source order, which is what the layers
 * resolve to for a single stylesheet anyway) and re-injects the result.
 */

export function supportsCascadeLayers(): boolean {
  if (typeof window === "undefined") return true;
  return (
    typeof (window as unknown as { CSSLayerBlockRule?: unknown }).CSSLayerBlockRule !== "undefined"
  );
}

/** Removes `@layer name { ... }` wrappers, keeping their contents inline. */
export function unwrapLayers(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@layer", i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    // Find the end of the prelude: either `{` (block) or `;` (statement).
    let j = at + 6;
    while (j < css.length && css[j] !== "{" && css[j] !== ";") j++;
    if (j >= css.length) break;
    if (css[j] === ";") {
      // `@layer a, b;` declaration — drop it entirely.
      i = j + 1;
      continue;
    }
    // Walk to the matching closing brace.
    let depth = 1;
    let k = j + 1;
    while (k < css.length && depth > 0) {
      const ch = css[k];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      k++;
    }
    // Recurse into the body for nested layers.
    out += unwrapLayers(css.slice(j + 1, k - 1));
    i = k;
  }
  return out;
}

export async function applyLayerShim(): Promise<boolean> {
  if (supportsCascadeLayers()) return false;
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  ).filter((l) => {
    try {
      return new URL(l.href, location.href).origin === location.origin;
    } catch {
      return false;
    }
  });
  let applied = false;
  for (const link of links) {
    if (link.dataset["layerShim"] === "done") continue;
    try {
      const res = await fetch(link.href, { cache: "reload" });
      if (!res.ok) continue;
      const css = await res.text();
      if (css.indexOf("@layer") === -1) continue;
      const style = document.createElement("style");
      style.setAttribute("data-layer-shim", "1");
      style.textContent = unwrapLayers(css);
      document.head.appendChild(style);
      link.dataset["layerShim"] = "done";
      applied = true;
    } catch {
      /* offline or blocked — nothing we can do */
    }
  }
  return applied;
}
