import type { LogLine } from "./use-adb-bridge";
import { KIND_LABEL, type BridgeEndpoint, type LinkState } from "./bridge";

export type SessionSnapshot = {
  state: LinkState;
  latency: number | null;
  activeId: string | null;
  target: string;
  endpoints: BridgeEndpoint[];
  log: LogLine[];
};

const stamp = (ms: number) => new Date(ms).toISOString().replace("T", " ").replace("Z", "");

/**
 * Plain-text troubleshooting report. Tokens are redacted — this file is meant
 * to be pasted into a bug report.
 */
export function buildSessionReport(snap: SessionSnapshot): string {
  const now = Date.now();
  const lines: string[] = [];
  const ua = typeof navigator === "undefined" ? "unknown" : navigator.userAgent;
  const href = typeof window === "undefined" ? "unknown" : window.location.href;

  lines.push("APEX WATCH — BRIDGE SESSION LOG");
  lines.push(`generated : ${stamp(now)} UTC`);
  lines.push(`page      : ${href}`);
  lines.push(`agent     : ${ua}`);
  lines.push(
    `screen    : ${typeof window === "undefined" ? "?" : `${window.innerWidth}x${window.innerHeight}`}`,
  );
  lines.push("");
  lines.push("-- LINK ------------------------------------------------------");
  lines.push(`state     : ${snap.state}`);
  lines.push(`latency   : ${snap.latency !== null ? `${snap.latency} ms` : "n/a"}`);
  lines.push(`adb target: ${snap.target || "(unset)"}`);
  lines.push("");
  lines.push("-- ENDPOINTS (failover order) --------------------------------");
  snap.endpoints.forEach((e, i) => {
    const flags = [
      e.enabled ? "on" : "off",
      e.id === snap.activeId ? "ACTIVE" : null,
      e.token ? "token:set" : "token:none",
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`${i + 1}. ${KIND_LABEL[e.kind]} ${e.url} [${flags}]`);
  });
  lines.push("");

  const counts = snap.log.reduce<Record<string, number>>((acc, l) => {
    acc[l.kind] = (acc[l.kind] ?? 0) + 1;
    return acc;
  }, {});
  lines.push("-- LOG -------------------------------------------------------");
  lines.push(
    `entries   : ${snap.log.length} (sent ${counts["sent"] ?? 0} · out ${counts["out"] ?? 0} · err ${counts["err"] ?? 0} · sys ${counts["sys"] ?? 0})`,
  );
  lines.push("");

  // oldest first reads better in a report
  [...snap.log].reverse().forEach((l) => {
    lines.push(`[${stamp(l.at)}] ${l.kind.toUpperCase().padEnd(4)} ${l.text}`);
  });

  if (snap.log.length === 0) lines.push("(no traffic recorded)");
  lines.push("");
  return lines.join("\n");
}

export function reportFilename(): string {
  return `apex-bridge-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.txt`;
}

/** Trigger a file download on the watch browser. */
export function downloadReport(text: string, filename = reportFilename()) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Android share sheet — hands the report to any app on the watch/phone. */
export async function shareReport(text: string, filename = reportFilename()): Promise<string> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (!nav.share) throw new Error("share not supported");
  const file = new File([text], filename, { type: "text/plain" });
  try {
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename });
      return "shared file";
    }
    await nav.share({ title: filename, text });
    return "shared text";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "share cancelled";
    throw error;
  }
}

export async function copyReport(text: string): Promise<string> {
  if (!navigator.clipboard?.writeText) throw new Error("clipboard blocked");
  await navigator.clipboard.writeText(text);
  return "copied to clipboard";
}
