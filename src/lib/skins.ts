import { CB, MESH, WEATHER } from "@/lib/app-routes";

/**
 * Skin engine — one skeleton (slide-up + slide-over drawers, edge tabs,
 * bezel), three skins. Each app declares its accent and what lives in each
 * drawer; the ZStackPanels component renders them identically.
 *
 * CB deck keeps its own baked-in drawers; these skins cover Weather, Mesh
 * and the Watch console.
 */

export type SkinId = "cb" | "weather" | "mesh" | "watch" | "uap" | "ghost" | "mystic" | "shield";

export type AppSkin = {
  id: SkinId;
  /** CSS accent class hook: skin-<id> sets --skin-accent for tabs/sheets */
  accent: "amber" | "cyan" | "teal";
  /** bottom slide-up drawer */
  up: { label: string; title: string; links: { to: string; label: string; question?: string }[] };
  /** left slide-over drawer */
  left: { label: string; title: string; links: { to: string; label: string; question?: string }[] };
  /** right slide-over drawer */
  right: { label: string; title: string; links: { to: string; label: string; question?: string }[] };
  hintKey: string;
};

export const SKINS: Record<SkinId, AppSkin> = {
  shield: {
    id: "shield", accent: "amber", hintKey: "apex.zhint.shield",
    left: { label: "Links", title: "Shield references", links: [] },
    right: { label: "Notes", title: "Notes & scripts", links: [] },
    up: { label: "Maps", title: "Map instruments", links: [] },
  },
  mystic: {
    id: "mystic", accent: "amber", hintKey: "apex.zhint.mystic",
    left: { label: "3", title: "Three · grounded", links: [{ to: "/mystic-nine", label: "Pause and observe?", question: "Should I pause and observe?" }, { to: "/mystic-nine", label: "Safe to act?", question: "Is this a safe moment to act?" }] },
    up: { label: "6", title: "Six · possible", links: [{ to: "/mystic-nine", label: "What opens next?", question: "What path could open next?" }, { to: "/mystic-nine", label: "Reach out?", question: "Should I reach out?" }] },
    right: { label: "9", title: "Nine · unknown", links: [{ to: "/mystic-nine", label: "What am I missing?", question: "What am I missing?" }, { to: "/mystic-nine", label: "Wait for more?", question: "Should I wait for more information?" }] },
  },
  uap: {
    id: "uap", accent: "cyan", hintKey: "apex.zhint.uap",
    up: { label: "Maps", title: "Maps and signal", links: [{ to: "/map", label: "Position and estimate trails" }, { to: "/radar", label: "Live RF radar" }, { to: "/sextant", label: "Sextant anchor" }] },
    left: { label: "Links", title: "App links", links: [{ to: "/cb", label: "Sovereign CB" }, { to: "/wx", label: "Enphase weather" }] },
    right: { label: "Notes", title: "Field notes", links: [{ to: "/observe", label: "Field notes" }] },
  },
  ghost: {
    id: "ghost", accent: "teal", hintKey: "apex.zhint.ghost",
    up: { label: "Maps", title: "Maps and signal", links: [{ to: "/map", label: "Position and estimate trails" }, { to: "/radar", label: "Live RF radar" }, { to: "/sextant", label: "Sextant anchor" }] },
    left: { label: "Links", title: "App links", links: [{ to: "/cb", label: "Sovereign CB" }, { to: "/wx", label: "Enphase weather" }] },
    right: { label: "Notes", title: "Field notes", links: [{ to: "/observe", label: "Field notes" }] },
  },
  cb: {
    id: "cb",
    accent: "amber",
    up: { label: "Map", title: "Slide-up map", links: [{ to: "/map", label: "Position map" }] },
    left: { label: "Links", title: "Links", links: [{ to: "/map", label: "Position map" }, { to: CB.wrist, label: "Wrist CB" }] },
    right: { label: "Notes", title: "Field notes", links: [{ to: "/observe", label: "Field notes" }] },
    hintKey: "apex.zhint.cb",
  },
  weather: {
    id: "weather",
    accent: "cyan",
    up: { label: "Radar", title: "Doppler radar", links: [] },
    left: { label: "CB / Map", title: "CB and position", links: [
      { to: CB.radio, label: "Sovereign CB" },
      { to: WEATHER.map, label: "Full position map" },
    ] },
    right: { label: "Notes", title: "Weather study notes", links: [
      { to: WEATHER.briefing, label: "Printable briefing" },
    ] },
    hintKey: "apex.zhint.wx",
  },
  mesh: {
    id: "mesh",
    accent: "teal",
    // Skeleton rule: links left, work right, map bottom.
    up: { label: "Map", title: "Event floor map", links: [
      { to: MESH.events, label: "Event floor & range rings" },
    ] },
    left: { label: "Find", title: "Find and rooms", links: [
      { to: MESH.events, label: "All events" },
      { to: MESH.noTower, label: "No-tower chat & rooms" },
      { to: MESH.manage, label: "Manage event & private links" },
    ] },
    right: { label: "Messages", title: "Messages and pickup", links: [
      { to: MESH.vendor, label: "Vendor desk & pickup" },
    ] },
    hintKey: "apex.zhint.mesh",
  },
  watch: {
    id: "watch",
    accent: "amber",
    up: { label: "PTT", title: "Push to talk", links: [{ to: CB.wrist, label: "Wrist CB" }] },
    left: { label: "Tools", title: "Watch pocket", links: [
      { to: "/radar", label: "Radar" },
      { to: "/sextant", label: "Sextant" },
      { to: "/map", label: "Tremen trail map" },
      { to: CB.wrist, label: "Wrist CB" },
    ] },
    right: { label: "Apps", title: "Other apps", links: [
      { to: CB.radio, label: "Sovereign CB" },
      { to: MESH.events, label: "Event mesh" },
      { to: WEATHER.hub, label: "Enphase weather" },
    ] },
    hintKey: "apex.zhint.watch",
  },
};
