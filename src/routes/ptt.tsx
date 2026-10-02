import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old PTT page. The radio now lives on the Sovereign CB deck at /cb —
 * same channels, same buses, same carriers — so every old link, bookmark
 * and home-screen shortcut lands on the new face instead of the old one.
 */
export const Route = createFileRoute("/ptt")({
  beforeLoad: ({ location }) => {
    throw redirect({ href: `/cb${location.searchStr ?? ""}`, replace: true });
  },
  head: () => ({
    meta: [
      { title: "PTT — Sovereign CB push-to-talk" },
      {
        name: "description",
        content: "Push-to-talk on CB channels 1-40 now opens on the Sovereign CB radio deck.",
      },
      { property: "og:title", content: "PTT — Sovereign CB push-to-talk" },
      {
        property: "og:description",
        content: "Push-to-talk on CB channels 1-40 now opens on the Sovereign CB radio deck.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
