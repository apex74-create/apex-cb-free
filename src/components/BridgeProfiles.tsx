import { useEffect, useState } from "react";
import {
  activeProfileId,
  applyProfile,
  captureProfile,
  loadProfiles,
  profileSummary,
  removeProfile,
  saveProfiles,
  setActiveProfileId,
  upsertProfile,
  type BridgeProfile,
} from "@/lib/bridge-profiles";
import type { BridgeEndpoint } from "@/lib/bridge";

/**
 * Saved connection profiles.
 *
 * Snapshot the current chain under a name, then switch setups with one tap —
 * hosts, ports and tokens come back exactly as saved.
 */
export default function BridgeProfiles({
  endpoints,
  target,
  onLoad,
}: {
  endpoints: BridgeEndpoint[];
  target: string;
  /** Push a loaded profile into the live editor + dial loop. */
  onLoad: (endpoints: BridgeEndpoint[], target: string) => void;
}) {
  const [profiles, setProfiles] = useState<BridgeProfile[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setProfiles(loadProfiles());
    setActive(activeProfileId());
  }, []);

  const persist = (list: BridgeProfile[]) => {
    setProfiles(list);
    saveProfiles(list);
  };

  const save = () => {
    const label = name.trim() || `profile ${profiles.length + 1}`;
    const profile = captureProfile(label, endpoints, target);
    const list = upsertProfile(profiles, profile);
    persist(list);
    const stored = list.find((p) => p.name.toLowerCase() === label.toLowerCase());
    if (stored) {
      setActiveProfileId(stored.id);
      setActive(stored.id);
    }
    setName("");
    setStatus(`saved "${label}"`);
  };

  const load = (profile: BridgeProfile) => {
    applyProfile(profile);
    setActive(profile.id);
    onLoad(
      profile.endpoints.map((e) => ({ ...e })),
      profile.target,
    );
    setStatus(`switched to "${profile.name}"`);
  };

  return (
    <section className="mb-3 rounded-sm border border-border p-2">
      <p className="pb-1 text-[8px] uppercase tracking-widest text-muted-foreground">
        Connection profiles
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name this setup"
          spellCheck={false}
          aria-label="Profile name"
          className="w-full rounded-sm border border-border bg-card px-1.5 py-1 text-[9px] text-foreground outline-none focus:border-signal"
        />
        <button
          type="button"
          onClick={save}
          className="rounded-sm border border-signal py-1 text-[8px] uppercase tracking-widest text-signal"
        >
          save
        </button>
      </div>

      <ul className="mt-1 space-y-1">
        {profiles.length === 0 ? (
          <li className="text-[8px] uppercase tracking-widest text-muted-foreground">
            no profiles saved yet
          </li>
        ) : (
          profiles.map((profile) => (
            <li
              key={profile.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-sm border p-1.5 ${
                active === profile.id ? "border-signal" : "border-border"
              }`}
            >
              <button type="button" onClick={() => load(profile)} className="min-w-0 text-left">
                <span className="block truncate text-[9px] font-bold uppercase tracking-widest text-signal">
                  {active === profile.id ? "● " : ""}
                  {profile.name}
                </span>
                <span className="block truncate text-[7px] text-muted-foreground">
                  {profileSummary(profile)} · adb {profile.target || "unset"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => load(profile)}
                className="shrink-0 rounded-sm border border-scan px-1.5 py-0.5 text-[7px] uppercase tracking-widest text-scan"
              >
                use
              </button>
              <button
                type="button"
                aria-label={`Delete profile ${profile.name}`}
                onClick={() => {
                  persist(removeProfile(profiles, profile.id));
                  if (active === profile.id) {
                    setActiveProfileId(null);
                    setActive(null);
                  }
                  setStatus(`removed "${profile.name}"`);
                }}
                className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[7px] uppercase tracking-widest text-muted-foreground"
              >
                ✕
              </button>
            </li>
          ))
        )}
      </ul>

      {status ? (
        <p className="pt-1 text-[7px] uppercase tracking-widest text-warn">{status}</p>
      ) : null}
    </section>
  );
}
