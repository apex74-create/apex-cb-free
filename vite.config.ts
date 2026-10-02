// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { unwrapLayers } from "./src/lib/layer-shim.ts";

/**
 * The LOKMAT watch WebView predates CSS cascade layers, so it drops Tailwind's
 * entire `@layer` output and renders unstyled HTML. Flattening the emitted CSS
 * keeps source order (which is what the layers resolve to for a single sheet)
 * and makes the stylesheet parseable on those browsers with no runtime shim.
 */
const flattenCssLayers = () => ({
  name: "apex-flatten-css-layers",
  enforce: "post" as const,
  generateBundle(
    _options: unknown,
    bundle: Record<string, { type: string; fileName: string; source?: unknown }>,
  ) {
    for (const file of Object.values(bundle)) {
      if (
        file.type === "asset" &&
        file.fileName.endsWith(".css") &&
        typeof file.source === "string"
      ) {
        file.source = unwrapLayers(file.source);
      }
    }
  },
});

// No PWA cache worker: installability comes from public/manifest.webmanifest,
// and public/sw.js is a kill-switch that evicts the old offline worker.
export default defineConfig({
  // Do NOT pin a nitro preset here. The hosted deployment targets the edge
  // runtime; forcing "node-server" produced an entry the host cannot run, so
  // every SSR route answered 500 while static assets still served. Local ADB
  // watch serving uses `vite preview` / the agent scripts instead.
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "ssr-entry" },
  },
  vite: {
    plugins: [flattenCssLayers()],
    // Pre-bundle everything up front. Late discovery forces a dep re-optimize
    // mid-session, which hands the page a second React under a new ?v= hash
    // and blanks it with "Cannot read properties of null (reading 'use')".
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "@tanstack/react-store",
        "@supabase/supabase-js",
        "leaflet",
        "esptool-js",
      ],
    },
    // Legacy syntax downleveling is CLIENT ONLY. Applying it to the SSR build
    // made esbuild emit an `__exportAll` helper split across two circularly
    // importing server chunks, so every SSR request died with
    // "TypeError: __exportAll is not a function" and answered 500.
    environments: {
      client: {
        build: {
          // The watch's stock WebView is several Chrome releases behind the
          // Vite default, so ship syntax it can actually parse or nothing
          // hydrates. AOSP 10 stock WebView can trail Chrome 87.
          target: ["chrome70", "safari12"],
        },
      },
    },
  },
});
