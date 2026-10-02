/**
 * Device / Android-version compatibility gate.
 *
 * Every check reads real device output over the ADB bridge — SDK level, CPU
 * ABI list and the platform feature table. Nothing is inferred from the model
 * name, because LOKMAT ships several boards under one product photo.
 */

import type { Assembly } from "./assembly";

/** One sweep that covers version, ABI and VPN capability. */
export const compatCmd =
  "shell getprop ro.build.version.sdk; getprop ro.build.version.release; getprop ro.product.cpu.abilist; getprop ro.product.model";

export const compatFeaturesCmd = "shell pm list features";

export type DeviceProfile = {
  sdk: number | null;
  release: string;
  abis: string[];
  model: string;
  features: string[];
};

export function parseCompat(raw: string, featuresRaw = ""): DeviceProfile {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const sdkLine = lines.find((l) => /^\d{1,2}$/.test(l));
  const abiLine = lines.find((l) => /(arm|x86)/i.test(l)) ?? "";
  const releaseLine = lines.find((l) => /^\d+(\.\d+)*$/.test(l) && l !== sdkLine) ?? "";
  return {
    sdk: sdkLine ? Number(sdkLine) : null,
    release: releaseLine,
    abis: abiLine
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    model: lines.find((l) => !/^[\d.,]+$/.test(l) && !/(arm|x86)/i.test(l)) ?? "",
    features: featuresRaw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("feature:"))
      .map((l) => l.slice(8).split("=")[0]!.trim())
      .filter(Boolean),
  };
}

export type Verdict = "ok" | "warn" | "block" | "unknown";

export type CompatResult = {
  verdict: Verdict;
  reasons: string[];
};

/**
 * Decide whether a component may be installed on the connected device.
 * "block" = the APK will refuse to install or cannot function at all.
 * "warn"  = it installs but needs an extra step from the operator.
 */
export function checkCompat(a: Assembly, d: DeviceProfile | null): CompatResult {
  if (!d || d.sdk === null) return { verdict: "unknown", reasons: ["device not swept yet"] };

  const reasons: string[] = [];
  let verdict: Verdict = "ok";

  if (a.minSdk && d.sdk < a.minSdk) {
    verdict = "block";
    reasons.push(
      `needs android sdk ${a.minSdk}+ — device reports ${d.sdk}${d.release ? ` (${d.release})` : ""}`,
    );
  }

  if (a.abis?.length && d.abis.length) {
    const match = a.abis.some((x) => d.abis.includes(x));
    if (!match) {
      verdict = "block";
      reasons.push(
        `no matching cpu abi (needs ${a.abis.join(" / ")}, device: ${d.abis.join(", ")})`,
      );
    }
  }

  for (const f of a.needsFeatures ?? []) {
    if (d.features.length && !d.features.includes(f)) {
      verdict = verdict === "block" ? "block" : "warn";
      reasons.push(`platform feature missing: ${f}`);
    }
  }

  if (a.maxSdkWarn && d.sdk >= a.maxSdkWarn && verdict !== "block") {
    verdict = "warn";
    reasons.push(
      `android ${d.release || d.sdk} kills background "phantom" processes — disable the limiter or the agent gets reaped`,
    );
  }

  if (verdict === "ok")
    reasons.push(
      `sdk ${d.sdk}${d.release ? ` (android ${d.release})` : ""} · ${d.abis[0] ?? "abi ?"}`,
    );
  return { verdict, reasons };
}
