/**
 * The paid download branch.
 *
 * Buying a licence is what opens a source or artifact branch. This file is the
 * public description of those branches — names, what is inside, and which
 * licence opens them. It carries no URL to anything private: the actual
 * access grant is resolved server-side in `src/utils/downloads.functions.ts`
 * against the account's licences, never from anything the browser can set.
 */

export type DownloadBranch = {
  id: string;
  name: string;
  summary: string;
  /** What the buyer receives once the branch is open. */
  contents: string[];
  /** Any one of these licence slugs opens it. */
  unlockedBy: string[];
  /** Branch reference handed out on grant, e.g. `release/weather`. */
  ref: string;
  /** Source branch, or a built artifact channel. */
  kind: "source" | "artifact";
};

export const DOWNLOAD_BRANCHES: DownloadBranch[] = [
  {
    id: "weather-app",
    name: "Weather app build",
    summary: "The forecast app on its own: installable web build and the Android package.",
    contents: [
      "Installable web build (PWA)",
      "Android package, Play-signed",
      "Offline watch screen",
    ],
    unlockedBy: [
      "weather-basic",
      "enphase-operator",
      "apex-signal-watch",
      "operator-field",
      "tremor-full",
      "apex-full-stack",
      "apex-mobile-monthly",
      "apex-operator-monthly",
      "apex-full-stack-monthly",
    ],
    ref: "release/weather",
    kind: "artifact",
  },
  {
    id: "signal-field",
    name: "Signal field build",
    summary: "The whole field deck: encrypted CB, mesh, map, tools and the watch screen.",
    contents: [
      "Installable web build and Android package",
      "Encrypted CB and mesh deck",
      "Tool deck, map and sensor console",
    ],
    unlockedBy: [
      "apex-signal-watch",
      "operator-field",
      "tremor-full",
      "apex-full-stack",
      "apex-operator-monthly",
      "apex-full-stack-monthly",
    ],
    ref: "release/signal",
    kind: "artifact",
  },
  {
    id: "operator-field-kit",
    name: "Operator field kit",
    summary:
      "Mesh deployment, rescue modes and the network tool deck, with the self-host bundle.",
    contents: [
      "Everything in the signal field build",
      "Mesh deployment and rescue-mode configuration",
      "Self-host bundle: run it on your own domain",
    ],
    unlockedBy: ["operator-field", "apex-full-stack", "apex-full-stack-monthly"],
    ref: "release/operator",
    kind: "artifact",
  },
  {
    id: "tremor-source",
    name: "Tremor Map Engine source",
    summary:
      "The mapping engine sources, plus every other shipping application as the repository grows.",
    contents: [
      "Tremor Map Engine source branch",
      "Application sources for every shipping product",
      "New applications added to the same branch as they ship",
    ],
    unlockedBy: ["tremor-full", "apex-full-stack"],
    ref: "download/tremor-full",
    kind: "source",
  },
  {
    id: "full-stack-source",
    name: "Full stack download branch",
    summary: "The published sources you are entitled to, as one branch, kept current.",
    contents: [
      "Every published application source",
      "Self-host deployment notes",
      "Release tags matching each store build",
    ],
    unlockedBy: ["apex-full-stack", "apex-source-licence"],
    ref: "download/full-stack",
    kind: "source",
  },
];

/**
 * Nothing in the published sources carries engine coefficients, signing keys
 * or customer records. Stated here so the rule travels with the branch list.
 */
export const BRANCH_EXCLUSIONS = [
  "No engine coefficients, phase constants or damping rules.",
  "No signing keys, keystores or release credentials.",
  "No customer records, licence keys or account data.",
];

export function branchesFor(slugs: Iterable<string>): DownloadBranch[] {
  const held = new Set(slugs);
  return DOWNLOAD_BRANCHES.filter((branch) => branch.unlockedBy.some((s) => held.has(s)));
}
