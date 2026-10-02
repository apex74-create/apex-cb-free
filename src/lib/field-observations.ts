/**
 * Human observation loop — gated ground-truth taps that check the radio /
 * station reports against what a grower actually sees. Only the preset
 * answers below are accepted (no free text), so the 3-6-9 engine is never
 * prompted with arbitrary weather input.
 *
 *   6 = ground confirms the report   3 = ground contradicts it
 *   9 = changing / unsure — hold tension, watch the next frames
 */
import { anchor } from "@/lib/engines/vertex-filing";
import type { TriState } from "@/lib/engines/tristar-thought";

export type Trend = "same" | "building" | "easing" | "just_changed";

export type ObsBlock = {
  id: "wind" | "rain" | "sky" | "temp" | "frost" | "dew" | "storm" | "smoke";
  label: string;
  question: string;
  choices: string[];
};

export const OBS_BLOCKS: ObsBlock[] = [
  { id: "wind", label: "Wind", question: "The report says wind — what's it doing at your rows?", choices: ["Calm", "Light breeze", "Steady wind", "Gusting hard"] },
  { id: "rain", label: "Rain", question: "The report says rain — what's falling on the field?", choices: ["Dry", "Mist / drizzle", "Steady rain", "Downpour"] },
  { id: "sky", label: "Sky", question: "The report says sky cover — what do you see overhead?", choices: ["Clear", "Partly cloudy", "Overcast", "Fog"] },
  { id: "temp", label: "Temp", question: "Compared to the reported temperature, it feels…", choices: ["Colder", "About right", "Warmer"] },
  { id: "frost", label: "Frost", question: "Any frost on leaves or low spots?", choices: ["None", "Low spots only", "On the canopy", "Hard freeze"] },
  { id: "dew", label: "Dew / wet leaf", question: "How wet are the leaves right now?", choices: ["Dry", "Damp", "Soaked"] },
  { id: "storm", label: "Storm", question: "Any storm signs?", choices: ["None", "Thunder heard", "Lightning seen", "Hail"] },
  { id: "smoke", label: "Smoke / haze", question: "Smoke or haze in the air?", choices: ["None", "Light haze", "Heavy smoke"] },
];

export const TRENDS: { id: Trend; label: string }[] = [
  { id: "same", label: "Same as a minute ago" },
  { id: "building", label: "Building" },
  { id: "easing", label: "Easing" },
  { id: "just_changed", label: "Just changed" },
];

export type FieldObservation = {
  block: ObsBlock["id"];
  reported: string;
  observed: string;
  trend: Trend;
  reportAgeMin: number | null;
  verdict: TriState;
  at: number;
};

/** Gate: only preset blocks and choices pass. */
export function isAllowed(block: string, reported: string, observed: string): boolean {
  const b = OBS_BLOCKS.find((x) => x.id === block);
  return !!b && b.choices.includes(reported) && b.choices.includes(observed);
}

/** 3-6-9 collapse for a ground check. */
export function verdictFor(reported: string, observed: string, trend: Trend): TriState {
  if (trend === "just_changed" || trend === "building") return 9;
  return reported === observed ? 6 : 3;
}

const LOCAL_KEY = "apex.field.observations";

export function readLocal(): FieldObservation[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]"); } catch { return []; }
}

/** Keep locally and file the collapse into the Vertex Filing System. */
export function recordLocal(obs: FieldObservation): FieldObservation[] {
  const list = [obs, ...readLocal()].slice(0, 100);
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* storage full */ }
  anchor(`ground:${obs.block}`, { state: obs.verdict, ...obs });
  return list;
}

/** ~1 km grid — enough to match a station, never a home address. */
export const toGrid = (n: number) => Math.round(n * 100) / 100;
