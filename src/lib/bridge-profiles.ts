/**
 * Saved bridge connection profiles.
 *
 * A profile is a whole named link setup — the failover chain (hosts, tokens,
 * enabled flags) plus the adb target — so the operator can flip between
 * "home Wi-Fi", "shop bench PC" and "4G relay" without retyping addresses.
 */

import {
  loadEndpoints,
  loadTarget,
  saveEndpoints,
  saveTarget,
  type BridgeEndpoint,
} from "./bridge";

export type BridgeProfile = {
  id: string;
  name: string;
  endpoints: BridgeEndpoint[];
  target: string;
  updatedAt: number;
};

const KEY = "apex.bridge.profiles";
const ACTIVE_KEY = "apex.bridge.profile.active";

function newId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function loadProfiles(): BridgeProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as BridgeProfile[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && typeof p.id === "string" && Array.isArray(p.endpoints));
  } catch {
    return [];
  }
}

export function saveProfiles(list: BridgeProfile[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function activeProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProfileId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
}

/** Snapshot the given (or currently stored) link setup under a name. */
export function captureProfile(
  name: string,
  endpoints: BridgeEndpoint[] = loadEndpoints(),
  target: string = loadTarget(),
): BridgeProfile {
  return {
    id: newId(),
    name: name.trim() || "profile",
    endpoints: endpoints.map((e) => ({ ...e })),
    target,
    updatedAt: Date.now(),
  };
}

export function upsertProfile(list: BridgeProfile[], profile: BridgeProfile): BridgeProfile[] {
  const i = list.findIndex(
    (p) => p.id === profile.id || p.name.toLowerCase() === profile.name.toLowerCase(),
  );
  if (i === -1) return [...list, profile];
  const next = [...list];
  next[i] = { ...profile, id: next[i]!.id };
  return next;
}

export function removeProfile(list: BridgeProfile[], id: string): BridgeProfile[] {
  return list.filter((p) => p.id !== id);
}

/** Write a profile back into the live bridge storage and mark it active. */
export function applyProfile(profile: BridgeProfile) {
  saveEndpoints(profile.endpoints);
  saveTarget(profile.target);
  setActiveProfileId(profile.id);
}

/** One-line summary for the switcher chips. */
export function profileSummary(profile: BridgeProfile): string {
  const on = profile.endpoints.filter((e) => e.enabled && e.url);
  const host = (() => {
    try {
      return on[0] ? new URL(on[0].url).host : "no agent";
    } catch {
      return "no agent";
    }
  })();
  return `${host} · ${on.length} slot${on.length === 1 ? "" : "s"}`;
}
