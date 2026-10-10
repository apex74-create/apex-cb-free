import { isCbPath } from "@/lib/cb-routes";
import { manifestFor, type HostInfo } from "@/lib/host";
import { resolveHost } from "@/lib/host.functions";
import { useOperatorAccess } from "@/lib/use-operator-access";
import { CB, MESH, WEATHER, SHARED } from "@/lib/app-routes";
import ApexBezel from "@/components/ApexBezel";
import { AppFrame } from "@/components/AppFrame";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { watchFaceMetrics } from "../lib/face-metrics";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BridgeProvider } from "../lib/bridge-context";
import OfflineBoot from "../components/OfflineBoot";
import PerfOverlay from "../components/PerfOverlay";
import ShellDock from "../components/ShellDock";
import AccountNav from "../components/AccountNav";
import BackButton from "../components/BackButton";
import ScreenAwake from "../components/ScreenAwake";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  useEffect(() => {
    const up = () => setOffline(false);
    const down = () => setOffline(true);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {offline ? "You're offline" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {offline
            ? "That page isn't saved on this device yet. Reconnect once and open it, and it'll work offline from then on. The CB deck keeps working without internet."
            : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Domain is fixed for the life of the page; resolved once, never refetched.
  loader: () => resolveHost(),
  staleTime: Infinity,
  head: ({ matches, loaderData }) => headFor(matches, (loaderData as HostInfo | undefined)?.app ?? null),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function headFor(matches: { routeId: unknown }[], app: HostInfo["app"]) {
  const cbPage = app === "cb" || matches.some((m) => isCbPath(m.routeId as string));
  return ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no",
      },
      { title: "TinyRadr Wave Forecast — Weather Prediction PWA" },
      {
        name: "description",
        content:
          "Wave-collapse weather prediction PWA with 62-day forecasts, map-based location picks, lovely forecast posts, and offline forecast caching.",
      },
      { name: "theme-color", content: "#000000" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:title", content: "TinyRadr Wave Forecast — Weather Prediction PWA" },
      {
        property: "og:description",
        content:
          "Wave-collapse weather prediction PWA with 62-day forecasts, map-based location picks, lovely forecast posts, and offline forecast caching.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TinyRadr Wave Forecast — Weather Prediction PWA" },
      {
        name: "twitter:description",
        content:
          "Wave-collapse weather prediction PWA with 62-day forecasts, map-based location picks, lovely forecast posts, and offline forecast caching.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap",
      },
      // Each domain installs its own app: encryptedcb.com -> Sovereign CB,
      // castnetmesh.com -> Cast Net Mesh, tinyradr.com -> Enphase weather.
      { rel: "manifest", href: manifestFor(app, cbPage) },
       { rel: "apple-touch-icon", sizes: "180x180", href: app === "shield" ? "/icons/shield-192.png" : app === "mesh" ? "/icons/mesh-192.png" : cbPage ? "/icons/cb-192.png" : "/apple-touch-icon.png" },
       { rel: "icon", type: "image/png", sizes: "192x192", href: app === "shield" ? "/icons/shield-192.png" : app === "mesh" ? "/icons/mesh-192.png" : cbPage ? "/icons/cb-192.png" : "/icons/icon-192.png" },
       { rel: "icon", type: "image/png", sizes: "512x512", href: app === "shield" ? "/icons/shield-512.png" : app === "mesh" ? "/icons/mesh-512.png" : cbPage ? "/icons/cb-512.png" : "/icons/icon-512.png" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  });
}


/**
 * Minimal terminal look baked into the document itself, so a device whose
 * stylesheet fails to arrive (stale cache, old WebView) still renders the dark
 * console instead of white unstyled HTML.
 */
const BASE_CSS = `html,body{margin:0;height:100%;background:#010804;color:#00ff3b;font-family:"Share Tech Mono","Courier New",ui-monospace,monospace;letter-spacing:.04em;-webkit-text-size-adjust:100%}
@layer base{a,button{color:inherit;font:inherit}}
canvas{display:block}`;

const WATCH_BOOT = `(function(){try{if(location.pathname!=='/'){return}var u=navigator.userAgent||'';var a=/Android\\s+(\\d+)/i.exec(u);var v=a?parseInt(a[1],10):99;var w=screen.width||0,h=screen.height||0,l=Math.max(w,h),s=Math.min(w,h);if(/Android|Mobile/i.test(u)&&v<=10&&l<=720&&s>0){location.replace('/watch.html')}}catch(e){}})();`;

// Runs before CSS and React. The physical panel + Android generation choose a
// renderer once; Chrome's desktop-site viewport switch cannot change it later.
function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: WATCH_BOOT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // One build, every form factor. Publishing the measured viewport on <html>
  // is what lets the same pages lay themselves out on a watch, a phone, a
  // tablet and a desktop without separate code paths.
  useEffect(() => watchFaceMetrics(), []);
  const location = useLocation();
  const path = location.pathname;
  const landing = path === "/";
  // Signal Network Operator package unlocks the bridge dot + operator tools.
  // Public app screens (CB, Mesh, Weather, shared) never dial the bridge or
  // show the dot without it.
  const operator = useOperatorAccess();
  const publicApp = isPublicAppPath(path);
  // Storefront surfaces share one sign-in bar; the field tools keep their dock.
  const storefront =
    landing ||
    path === "/inventory" ||
    path === "/account" ||
    path === "/store" ||
    path.startsWith("/store/") ||
    path === "/library" ||
    path.startsWith("/checkout");

  return (
    <QueryClientProvider client={queryClient}>
      {/* Holds the panel lit so pages don't paint then black out on watches. */}
      <ScreenAwake />
      {landing ? (
        <>
          <OfflineBoot />
          <AccountNav />
          <Outlet />
          <ApexBezel />
        </>
      ) : (
        <BridgeProvider enabled={operator}>
          <OfflineBoot />
          <PerfOverlay />
          {storefront ? (
            <>
              <AccountNav />
            </>
          ) : null}
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
           {frameSkin(path) === "weather" ? <AppFrame skin="weather" /> : frameSkin(path) === "mesh" ? <AppFrame skin="mesh" /> : frameSkin(path) === "watch" ? <AppFrame skin="watch" /> : frameSkin(path) === "uap" ? <AppFrame skin="uap" /> : frameSkin(path) === "ghost" ? <AppFrame skin="ghost" /> : frameSkin(path) === "mystic" ? <AppFrame skin="mystic" /> : frameSkin(path) === "shield" ? <AppFrame skin="shield" /> : null}
          {apexFramed(path) ? <ApexBezel skin={frameSkin(path) ?? undefined} /> : null}
          {/* Every page but home gets a way out. */}
          <BackButton />
          {operator ? <ShellDock /> : null}
        </BridgeProvider>
      )}
    </QueryClientProvider>
  );
}

const PUBLIC_PREFIXES = [
  ...Object.values(CB).filter((p) => p !== CB.face),
  ...Object.values(MESH).filter((p) => p !== MESH.bridge),
  ...Object.values(WEATHER),
  ...Object.values(SHARED).filter((p) => p !== "/"),
  "/weather",
  "/store/",
  "/checkout",
  "/library",
];

function isPublicAppPath(path: string) {
  return PUBLIC_PREFIXES.some((p) => path === p || (p.endsWith("/") ? path.startsWith(p) : path.startsWith(p + "/")));
}

/** Watch, Weather and Mesh screens wear the CB chassis frame; CB pages
 *  already carry their own bezel, operator tools stay plain. */
const APEX_FRAMED = [...Object.values(WEATHER), ...Object.values(MESH), "/weather", "/app", "/face", "/uap", "/ghost", "/mystic-nine", "/shield"];
function apexFramed(path: string) {
  return APEX_FRAMED.some((p) => path === p || path.startsWith(p + "/"));
}

function frameSkin(path: string): "weather" | "mesh" | "watch" | "uap" | "ghost" | "mystic" | "shield" | null {
  if (path === "/shield") return "shield";
  if (path === "/mystic-nine") return "mystic";
  if (path === "/uap") return "uap";
  if (path === "/ghost") return "ghost";
  if (Object.values(WEATHER).some((p) => path === p)) return "weather";
  if (path === "/app" || path === "/wcb" || path === "/face") return "watch";
  if (Object.values(MESH).filter((p) => p !== MESH.bridge && p !== MESH.splash).some((p) => path === p || path.startsWith(p + "/"))) return "mesh";
  return null;
}
