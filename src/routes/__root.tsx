import { isCbPath } from "@/lib/cb-routes";
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
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { watchFaceMetrics } from "../lib/face-metrics";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BridgeProvider } from "../lib/bridge-context";
import OfflineBoot from "../components/OfflineBoot";
import PerfOverlay from "../components/PerfOverlay";
import ShellDock from "../components/ShellDock";
import AccountNav from "../components/AccountNav";
import PaymentTestModeBanner from "../components/PaymentTestModeBanner";
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
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
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
  head: ({ matches }) => ({
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
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/dee6fa1d-e2dd-4770-8b8b-78b966d856f3",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/dee6fa1d-e2dd-4770-8b8b-78b966d856f3",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap",
      },
      // The CB is its own install: the server hands /cb its own manifest in
      // the first HTML, so Android offers "Sovereign CB" instead of TinyRadr.
      {
        rel: "manifest",
        href: matches.some((m) => isCbPath(m.routeId as string)) ? "/cb.webmanifest" : "/manifest.webmanifest",
      },
      { rel: "apple-touch-icon", sizes: "180x180", href: matches.some((m) => isCbPath(m.routeId as string)) ? "/icons/cb-192.png" : "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: matches.some((m) => isCbPath(m.routeId as string)) ? "/icons/cb-192.png" : "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: matches.some((m) => isCbPath(m.routeId as string)) ? "/icons/cb-512.png" : "/icons/icon-512.png" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/**
 * Minimal terminal look baked into the document itself, so a device whose
 * stylesheet fails to arrive (stale cache, old WebView) still renders the dark
 * console instead of white unstyled HTML.
 */
const BASE_CSS = `html,body{margin:0;height:100%;background:#010804;color:#00ff3b;font-family:"Share Tech Mono","Courier New",ui-monospace,monospace;letter-spacing:.04em;-webkit-text-size-adjust:100%}
a,button{color:inherit;font:inherit}
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
          <PaymentTestModeBanner />
          <AccountNav />
          <Outlet />
        </>
      ) : (
        <BridgeProvider>
          <OfflineBoot />
          <PerfOverlay />
          {storefront ? (
            <>
              <PaymentTestModeBanner />
              <AccountNav />
            </>
          ) : null}
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          {/* Every page but home gets a way out. */}
          <BackButton />
          <ShellDock />
        </BridgeProvider>
      )}
    </QueryClientProvider>
  );
}
