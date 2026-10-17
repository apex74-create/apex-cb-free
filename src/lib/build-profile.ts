import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Build profile — the switch between the published release build and the
 * admin test build used to validate SAS end to end before publishing.
 *
 * Everything lives on the watch (localStorage) so a device can be flipped into
 * test mode without a redeploy, and flipped back the same way.
 */
export type Profile = "release" | "test";

export type BuildConfig = {
  profile: Profile;
  /** GitHub source of truth for the agent assemblies the watch talks to. */
  owner: string;
  repo: string;
  /** Branch, tag or sha to validate against. */
  ref: string;
  /** SAS backend base URL, e.g. https://sas.example.com */
  sasUrl: string;
  /** Bearer token for the SAS tenant under test. Never leaves the watch. */
  sasKey: string;
  /** Tenant/account the test build should exercise. */
  tenant: string;
  /** Send SAS traffic to the staging path instead of live tenant data. */
  staging: boolean;
};

export const DEFAULT_BUILD: BuildConfig = {
  profile: "release",
  owner: "emanuele-f",
  repo: "PCAPdroid",
  ref: "master",
  sasUrl: "",
  sasKey: "",
  tenant: "",
  staging: true,
};

const KEY = "apex.buildProfile";
const EVENT = "apex:build-profile";

export function loadBuild(): BuildConfig {
  if (typeof window === "undefined") return DEFAULT_BUILD;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_BUILD;
    const p = JSON.parse(raw) as Partial<BuildConfig>;
    return {
      ...DEFAULT_BUILD,
      ...p,
      profile: p.profile === "test" ? "test" : "release",
      staging: p.staging !== false,
    };
  } catch {
    return DEFAULT_BUILD;
  }
}

export function saveBuild(next: BuildConfig) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  document.documentElement.dataset["build"] = next.profile;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

/** Read the profile outside React — feature gates use this. */
export function isTestBuild(): boolean {
  return loadBuild().profile === "test";
}

export function onBuildChange(fn: (c: BuildConfig) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<BuildConfig>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export function useBuildConfig() {
  const [config, setConfig] = useState<BuildConfig>(DEFAULT_BUILD);
  const ref = useRef<BuildConfig>(DEFAULT_BUILD);
  ref.current = config;

  useEffect(() => {
    const initial = loadBuild();
    ref.current = initial;
    setConfig(initial);
    document.documentElement.dataset["build"] = initial.profile;
    return onBuildChange((next) => {
      ref.current = next;
      setConfig(next);
    });
  }, []);

  const update = useCallback(<K extends keyof BuildConfig>(key: K, value: BuildConfig[K]) => {
    const next = { ...ref.current, [key]: value };
    ref.current = next;
    setConfig(next);
    saveBuild(next);
  }, []);

  return { config, update };
}

// ---------------------------------------------------------------------------
// Preflight — real network checks, no stubs. Each step reports what it saw.
// ---------------------------------------------------------------------------

export type StepState = "pending" | "running" | "pass" | "warn" | "fail";

export type Step = {
  id: string;
  label: string;
  state: StepState;
  detail: string;
  ms?: number;
};

export const STEP_IDS = [
  "context",
  "repo",
  "ref",
  "assemblies",
  "sas-reach",
  "sas-auth",
  "sas-ingest",
  "bridge",
] as const;

const LABELS: Record<(typeof STEP_IDS)[number], string> = {
  context: "runtime context",
  repo: "github repo",
  ref: "ref resolves",
  assemblies: "release assemblies",
  "sas-reach": "sas reachable",
  "sas-auth": "sas auth",
  "sas-ingest": "sas ingest probe",
  bridge: "adb bridge link",
};

export function blankSteps(): Step[] {
  return STEP_IDS.map((id) => ({
    id,
    label: LABELS[id],
    state: "pending" as StepState,
    detail: "",
  }));
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const out = await fn();
  return [out, Math.round(performance.now() - t0)];
}

async function jsonGet(url: string, headers: Record<string, string> = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 200);
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

const GH = "https://api.github.com";

export type PreflightInput = {
  config: BuildConfig;
  /** Current bridge link state, so the run reflects the real device link. */
  bridgeState: string;
};

/**
 * Runs the checks one at a time, emitting after each so the watch can render
 * progress on a 400px face. Returns the final list.
 */
export async function runPreflight(
  input: PreflightInput,
  emit: (steps: Step[]) => void,
): Promise<Step[]> {
  const { config: c, bridgeState } = input;
  const steps = blankSteps();
  const set = (id: string, patch: Partial<Step>) => {
    const i = steps.findIndex((s) => s.id === id);
    if (i >= 0) steps[i] = { ...steps[i]!, ...patch };
    emit([...steps]);
  };

  // 1. Runtime context — catches the mixed-content trap before anything else.
  set("context", { state: "running" });
  {
    const https = window.location.protocol === "https:";
    const secure = window.isSecureContext;
    set("context", {
      state: https || secure ? "pass" : "warn",
      detail: `${window.location.protocol}//${window.location.host} · ${
        secure ? "secure context" : "insecure context"
      }${https ? " · plain ws:// agents blocked" : ""}`,
    });
  }

  // 2 + 3. Repo and ref, straight from the GitHub API.
  set("repo", { state: "running" });
  let repoOk = false;
  try {
    const [r, ms] = await timed(() => jsonGet(`${GH}/repos/${c.owner}/${c.repo}`));
    const b = r.body as { full_name?: string; default_branch?: string; message?: string };
    repoOk = r.ok;
    set("repo", {
      state: r.ok ? "pass" : "fail",
      ms,
      detail: r.ok
        ? `${b.full_name} · default ${b.default_branch}`
        : `${r.status} ${b.message ?? "not reachable"}`,
    });
  } catch (e) {
    set("repo", { state: "fail", detail: e instanceof Error ? e.message : "request failed" });
  }

  set("ref", { state: "running" });
  if (!repoOk) {
    set("ref", { state: "fail", detail: "skipped — repo unreachable" });
  } else {
    try {
      const [r, ms] = await timed(() =>
        jsonGet(`${GH}/repos/${c.owner}/${c.repo}/commits/${encodeURIComponent(c.ref)}`),
      );
      const b = r.body as {
        sha?: string;
        commit?: { committer?: { date?: string }; message?: string };
        message?: string;
      };
      set("ref", {
        state: r.ok ? "pass" : "fail",
        ms,
        detail: r.ok
          ? `${(b.sha ?? "").slice(0, 8)} · ${(b.commit?.committer?.date ?? "").slice(0, 10)}`
          : `${r.status} ${b.message ?? "ref not found"}`,
      });
    } catch (e) {
      set("ref", { state: "fail", detail: e instanceof Error ? e.message : "request failed" });
    }
  }

  // 4. Assemblies the watch actually depends on: the published release assets.
  set("assemblies", { state: "running" });
  if (!repoOk) {
    set("assemblies", { state: "fail", detail: "skipped — repo unreachable" });
  } else {
    try {
      const [r, ms] = await timed(() =>
        jsonGet(`${GH}/repos/${c.owner}/${c.repo}/releases/latest`),
      );
      const b = r.body as { tag_name?: string; assets?: { name: string; size: number }[] };
      const assets = b.assets ?? [];
      set("assemblies", {
        state: r.ok && assets.length > 0 ? "pass" : r.ok ? "warn" : "fail",
        ms,
        detail: r.ok
          ? assets.length > 0
            ? `${b.tag_name} · ${assets.length} assets · ${assets
                .slice(0, 2)
                .map((a) => a.name)
                .join(", ")}`
            : `${b.tag_name} · no published assets`
          : `${r.status} no release found`,
      });
    } catch (e) {
      set("assemblies", {
        state: "fail",
        detail: e instanceof Error ? e.message : "request failed",
      });
    }
  }

  // 5-7. SAS backend: reachability, auth, then a real ingest round-trip.
  const base = c.sasUrl.trim().replace(/\/+$/, "");
  const prefix = c.staging ? "/staging" : "";
  if (!base) {
    for (const id of ["sas-reach", "sas-auth", "sas-ingest"]) {
      set(id, { state: "warn", detail: "no sas url configured" });
    }
  } else {
    set("sas-reach", { state: "running" });
    let reachable = false;
    try {
      const [r, ms] = await timed(() => jsonGet(`${base}${prefix}/health`));
      reachable = r.status > 0;
      set("sas-reach", {
        state: r.ok ? "pass" : "fail",
        ms,
        detail: `${r.status} ${typeof r.body === "string" ? r.body : JSON.stringify(r.body).slice(0, 80)}`,
      });
    } catch (e) {
      set("sas-reach", {
        state: "fail",
        detail: e instanceof Error ? `${e.message} (cors or host down)` : "request failed",
      });
    }

    set("sas-auth", { state: "running" });
    if (!c.sasKey) {
      set("sas-auth", { state: "warn", detail: "no api key entered" });
    } else if (!reachable) {
      set("sas-auth", { state: "fail", detail: "skipped — host unreachable" });
    } else {
      try {
        const [r, ms] = await timed(() =>
          jsonGet(`${base}${prefix}/v1/me`, {
            Authorization: `Bearer ${c.sasKey}`,
            ...(c.tenant ? { "X-Tenant": c.tenant } : {}),
          }),
        );
        set("sas-auth", {
          state: r.ok ? "pass" : r.status === 401 || r.status === 403 ? "fail" : "warn",
          ms,
          detail: `${r.status} ${
            typeof r.body === "string" ? r.body : JSON.stringify(r.body).slice(0, 80)
          }`,
        });
      } catch (e) {
        set("sas-auth", {
          state: "fail",
          detail: e instanceof Error ? e.message : "request failed",
        });
      }
    }

    set("sas-ingest", { state: "running" });
    if (!reachable || !c.sasKey) {
      set("sas-ingest", { state: "warn", detail: "needs a reachable host and key" });
    } else {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const t0 = performance.now();
        const res = await fetch(`${base}${prefix}/v1/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${c.sasKey}`,
            ...(c.tenant ? { "X-Tenant": c.tenant } : {}),
          },
          body: JSON.stringify({
            kind: "preflight",
            source: "apex-watch",
            profile: c.profile,
            at: new Date().toISOString(),
          }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const text = (await res.text()).slice(0, 120);
        set("sas-ingest", {
          state: res.ok ? "pass" : "fail",
          ms: Math.round(performance.now() - t0),
          detail: `${res.status} ${text || "accepted"}`,
        });
      } catch (e) {
        set("sas-ingest", {
          state: "fail",
          detail: e instanceof Error ? e.message : "request failed",
        });
      }
    }
  }

  // 8. The device link the tools depend on.
  set("bridge", {
    state: bridgeState === "online" ? "pass" : "warn",
    detail: `link ${bridgeState} — tools read live device data only when online`,
  });

  return steps;
}

export function summarize(steps: Step[]) {
  const pass = steps.filter((s) => s.state === "pass").length;
  const fail = steps.filter((s) => s.state === "fail").length;
  const warn = steps.filter((s) => s.state === "warn").length;
  // "Ready" means nothing is failing and nothing is unverified — a warn
  // (no SAS url, bridge offline) means that leg was never actually proven.
  return { pass, fail, warn, ready: fail === 0 && warn === 0 && pass === steps.length };
}

/** Plain-text report of a run, for pasting into an issue. */
export function reportText(c: BuildConfig, steps: Step[]) {
  const head = [
    `apex watch — test build preflight`,
    `when     ${new Date().toISOString()}`,
    `profile  ${c.profile}${c.staging ? " (staging)" : " (live)"}`,
    `source   ${c.owner}/${c.repo}@${c.ref}`,
    `sas      ${c.sasUrl || "(unset)"}${c.tenant ? ` · tenant ${c.tenant}` : ""}`,
    `key      ${c.sasKey ? "[redacted]" : "(unset)"}`,
    "",
  ];
  const body = steps.map(
    (s) =>
      `[${s.state.toUpperCase().padEnd(5)}] ${s.label}${s.ms ? ` (${s.ms}ms)` : ""} — ${s.detail}`,
  );
  return [...head, ...body].join("\n");
}
