import { createFileRoute, redirect } from "@tanstack/react-router";

// Short watch address: straight to the static multicolor face, no app load.
export const Route = createFileRoute("/w")({
  server: {
    handlers: {
      GET: () => new Response(null, { status: 302, headers: { Location: "/watch.html", "Cache-Control": "no-store" } }),
    },
  },
  beforeLoad: () => {
    if (typeof window !== "undefined") window.location.replace("/watch.html");
    throw redirect({ href: "/watch.html" });
  },
});
