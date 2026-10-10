/**
 * Full-assembly manifest: the third-party open-source components that ship
 * *alongside* Apex Signal in the sellable bundle. Nothing here is vendored
 * into our binary — each piece is installed from its own upstream release, so
 * the copyleft licences stay clean for a commercial listing.
 */

export type Assembly = {
  key: string;
  name: string;
  role: string;
  /** Upstream git repo — the source of truth we clone/pull from. */
  repo: string;
  /** Android package id, when the component is an APK. */
  pkg?: string;
  license: string;
  /** True when the licence forbids static bundling inside a paid binary. */
  copyleft: boolean;
  /** Release download page used by the installer script. */
  releases: string;
  /** F-Droid listing when there is one. */
  fdroid?: string;
  /** What the operator runs to put it on the device. */
  install?: string;
  /** Lowest Android SDK level the APK will install on. */
  minSdk?: number;
  /** CPU ABIs the native payload ships for; empty = pure java. */
  abis?: string[];
  /** Platform features the component needs to actually work. */
  needsFeatures?: string[];
  /** At/above this SDK the component installs but needs an extra step. */
  maxSdkWarn?: number;
  /** Extra shell steps once installed (Termux setup, permissions, ...). */
  post?: string[];
  notes: string;
};

export const ASSEMBLIES: Assembly[] = [
  {
    key: "pcapdroid",
    name: "PCAPdroid",
    role: "packet capture engine — VPN-mode capture, PCAPNG dumps, Intent API we drive from the watch",
    repo: "https://github.com/emanuele-f/PCAPdroid",
    pkg: "com.emanuelef.remote_capture",
    license: "GPL-3.0-or-later",
    copyleft: true,
    releases: "https://github.com/emanuele-f/PCAPdroid/releases/latest",
    fdroid: "https://f-droid.org/packages/com.emanuelef.remote_capture/",
    install: "adb install -r PCAPdroid.apk",
    minSdk: 21,
    abis: ["arm64-v8a", "armeabi-v7a", "x86_64", "x86"],
    post: [
      "adb shell appops set com.emanuelef.remote_capture ACTIVATE_VPN allow",
      "adb shell am start -n com.emanuelef.remote_capture/.activities.CaptureCtrl",
    ],
    notes:
      "Installed as a separate app and controlled over its documented Intent API. Set an api_key in /pcap so control intents are accepted without a prompt.",
  },
  {
    key: "pcapdroid-mitm",
    name: "PCAPdroid-mitm",
    role: "TLS decryption add-on for PCAPdroid",
    repo: "https://github.com/emanuele-f/PCAPdroid-mitm",
    pkg: "com.emanuelef.remote_capture.mitm",
    license: "GPL-3.0-or-later",
    copyleft: true,
    releases: "https://github.com/emanuele-f/PCAPdroid-mitm/releases/latest",
    install: "adb install -r PCAPdroid-mitm.apk",
    minSdk: 21,
    abis: ["arm64-v8a", "armeabi-v7a", "x86_64", "x86"],
    notes:
      "Optional. Only meaningful on devices you own or are authorised to test; the CA must be trusted manually.",
  },
  {
    key: "termux",
    name: "Termux",
    role: "on-device shell that hosts the companion agent, adb, node and the Reticulum stack",
    repo: "https://github.com/termux/termux-app",
    pkg: "com.termux",
    license: "GPL-3.0-only",
    copyleft: true,
    releases: "https://github.com/termux/termux-app/releases/latest",
    fdroid: "https://f-droid.org/packages/com.termux/",
    install: "adb install -r termux-app.apk",
    minSdk: 24,
    abis: ["arm64-v8a", "armeabi-v7a", "x86_64", "x86"],
    maxSdkWarn: 31,
    post: [
      "pkg update -y && pkg install -y nodejs android-tools openssl termux-api git",
      "termux-setup-storage",
      "node ~/apex/agent/adb-bridge-agent.mjs --port 3001",
    ],
    notes:
      "Termux and its plugins must come from the same signing source (all GitHub, or all F-Droid) or the plugin refuses to bind.",
  },
  {
    key: "termux-api",
    name: "Termux:API",
    role: "sensor, GPS, notification and telephony bridge for scripts running in Termux",
    repo: "https://github.com/termux/termux-api",
    pkg: "com.termux.api",
    license: "GPL-3.0-only",
    copyleft: true,
    releases: "https://github.com/termux/termux-api/releases/latest",
    fdroid: "https://f-droid.org/packages/com.termux.api/",
    install: "adb install -r termux-api.apk",
    minSdk: 24,
    maxSdkWarn: 31,
    post: ["pkg install -y termux-api", "termux-sensor -l", "termux-location -p gps"],
    notes:
      "Pairs with the termux-api package inside Termux. Same-source signing rule as the main app applies.",
  },
  {
    key: "termux-boot",
    name: "Termux:Boot",
    role: "auto-starts the companion agent after a phone reboot so the bridge comes back on its own",
    repo: "https://github.com/termux/termux-boot",
    pkg: "com.termux.boot",
    license: "GPL-3.0-only",
    copyleft: true,
    releases: "https://github.com/termux/termux-boot/releases/latest",
    fdroid: "https://f-droid.org/packages/com.termux.boot/",
    install: "adb install -r termux-boot.apk",
    minSdk: 24,
    maxSdkWarn: 31,
    post: [
      "mkdir -p ~/.termux/boot",
      "printf '#!/data/data/com.termux/files/usr/bin/sh\\ntermux-wake-lock\\nnode ~/apex/agent/adb-bridge-agent.mjs --port 3001\\n' > ~/.termux/boot/apex-agent",
      "chmod +x ~/.termux/boot/apex-agent",
    ],
    notes: "Optional but recommended for kiosk / field builds.",
  },
  {
    key: "reticulum",
    name: "Reticulum + LXMF",
    role: "off-grid mesh transport and message delivery used by Sovereign Netchat",
    repo: "https://github.com/markqvist/Reticulum",
    license: "MIT",
    copyleft: false,
    releases: "https://pypi.org/project/rns/",
    post: [
      "pkg install -y python",
      "python -m pip install --upgrade rns lxmf",
      "termux-setup-storage",
      "mkdir -p /sdcard/apex ~/.termux && cp /sdcard/Download/apex-netchat.py ~/netchat.py && printf 'allow-external-apps=true\\n' >> ~/.termux/termux.properties",
      "rnsd -d",
      "nohup python ~/netchat.py listen >> /sdcard/apex/listen.log 2>&1 &",
    ],
    notes:
      "The bridge agent deploys the Netchat helper; Termux installs and starts the real Reticulum/LXMF node.",
  },
];

/** Package ids we can look for in one `pm list packages` sweep. */
export const ASSEMBLY_PKGS = ASSEMBLIES.filter((a) => a.pkg).map((a) => a.pkg!);

export const pkgListCmd = "shell pm list packages";

export function parseInstalled(raw: string): Set<string> {
  const out = new Set<string>();
  for (const line of raw.split("\n")) {
    const m = line.trim().match(/^package:(\S+)$/);
    if (m) out.add(m[1]!);
  }
  return out;
}

/** Everything the bundle needs, as one paste-able block. */
export function fullInstallScript(): string {
  const lines = [
    "#!/usr/bin/env bash",
    "# Apex Signal — full assembly installer (fetches upstream releases, installs via adb)",
    "set -euo pipefail",
    "",
  ];
  for (const a of ASSEMBLIES) {
    lines.push(`# ${a.name} — ${a.license} — ${a.repo}`);
    lines.push(`# releases: ${a.releases}`);
    if (a.install) lines.push(a.install);
    for (const p of a.post ?? []) lines.push(`# ${p}`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Compliance line shown on the assembly screen. These are GPL apps: they can
 * be *distributed alongside* a paid product and launched over documented
 * interfaces, but they must not be statically linked into it, and their source
 * offer has to travel with the bundle.
 */
export const COMPLIANCE = [
  "Every third-party component is installed from its own upstream release — none of it is compiled into Apex Signal.",
  "Apex Signal talks to them over public, documented interfaces (Intent API, shell), which keeps them separate works.",
  "The bundle ships this manifest with repo + licence + release links so the source offer travels with the sale.",
  "Modified copies of a GPL component must be published under the same licence before you may distribute them.",
  "Sell the Apex Signal app and the support/telemetry service — never sell the GPL components themselves as your own.",
];

/**
 * First-party proprietary field scripts. NOT publicly served — sources live in
 * the private repo `agent/` folder only. Access is via the protected defense
 * API (paid tiers) or a confidential operator script licence. The fetch/run
 * fields describe licensed-delivery usage and are never rendered publicly.
 */
export type FieldScript = {
  key: string;
  name: string;
  file: string;
  role: string;
  /** Where in the product this script is actually used. */
  usedBy: string;
  fetch: string;
  run: string;
  notes: string;
};

export const FIELD_SCRIPTS: FieldScript[] = [
  {
    key: "tristar-proxy",
    name: "Tri-Star Traffic Sanitizer",
    file: "/agent/tristar_proxy.py",
    role: "Non-rooted 3-gate outbound proxy: PE sweet-spot sweep (368–370), randomized bracket (342–396) and hard-boundary scrape, with an 11,000 ms timed escapement release.",
    usedBy:
      "Sits in front of PCAPdroid's mitm socket so anything leaving the handset is scrubbed of IMEI, IMSI, MAC and precise location before it reaches the mesh or our aggregate endpoints — this is what enforces the fine-in / canonical-out rule the privacy statement and the data agreement promise.",
    fetch: "curl -fsSL https://tinyradr.lovable.app/agent/tristar_proxy.py -o ~/tristar_proxy.py",
    run: "pkg install python -y && python ~/tristar_proxy.py",
    notes:
      "Point PCAPdroid-mitm at 127.0.0.1 on the port the script prints. No root. Drops any field it cannot classify rather than forwarding it.",
  },
  {
    key: "new-barware",
    name: "New Barware — Trusted Cell Lock",
    file: "/agent/new_barware.sh",
    role: "Watches raw RIL radio logs for tracking-area changes from rogue base stations and refuses forced relocation by cutting cellular data only — the radio stays up for emergency calls.",
    usedBy:
      "The IMSI-catcher guard behind the operator field tier: it is what lets a crew keep working on mesh when a rogue tower tries to pull the handset off its trusted cell.",
    fetch: "curl -fsSL https://tinyradr.lovable.app/agent/new_barware.sh -o ~/new_barware.sh",
    run: "sh ~/new_barware.sh --pin   # then: sh ~/new_barware.sh --mode lock",
    notes:
      "Termux + wireless ADB on 127.0.0.1, no root. --pin learns the current tower; default mode monitors and alerts only. Log at ~/new_barware.log.",
  },
  {
    key: "termux-setup",
    name: "Termux Field Setup",
    file: "/agent/termux-setup.sh",
    role: "One-shot Termux preparation: packages, wake lock, boot hooks and the ADB pairing the other scripts assume.",
    usedBy: "Run first on any new handset before the bridge agent or the two guards above.",
    fetch: "curl -fsSL https://tinyradr.lovable.app/agent/termux-setup.sh -o ~/termux-setup.sh",
    run: "sh ~/termux-setup.sh",
    notes: "Safe to re-run; it skips anything already in place.",
  },
  {
    key: "bridge-agent",
    name: "ADB Bridge Agent",
    file: "/agent/adb-bridge-agent.mjs",
    role: "Local listener on port 3001 that the console's install and sweep buttons drive over the bridge.",
    usedBy:
      "Every live device read in this app — installed-package sweep, compatibility profile, one-tap installs.",
    fetch:
      "curl -fsSL https://tinyradr.lovable.app/agent/adb-bridge-agent.mjs -o ~/apex/agent/adb-bridge-agent.mjs",
    run: "node ~/apex/agent/adb-bridge-agent.mjs --port 3001",
    notes: "Bind it to localhost only. Nothing on it is reachable from off the handset.",
  },
];
