/**
 * Connection point to Copilot's AWS data API. Browser-side fetch only:
 * no AWS SDK and no AWS credentials ever live in the app. The base URL is
 * public (VITE_AWS_API_BASE) and can be overridden per device.
 */
import { getProduct, type ProductId } from "./product-builds";

const KEY = "apex.aws-api-base.v1";

export type AwsHealth = "unset" | "online" | "degraded" | "offline";

export function awsBase(): string {
  if (typeof window !== "undefined") {
    const o = window.localStorage.getItem(KEY);
    if (o) return o.replace(/\/+$/, "");
  }
  return ((import.meta.env["VITE_AWS_API_BASE"] as string | undefined) ?? "").replace(/\/+$/, "");
}

export function setAwsBase(url: string) {
  const u = url.trim();
  if (!u) window.localStorage.removeItem(KEY);
  else if (/^https:\/\//.test(u)) window.localStorage.setItem(KEY, u);
  else throw new Error("The AWS address must start with https://");
}

export async function checkAwsHealth(timeoutMs = 5000): Promise<AwsHealth> {
  const base = awsBase();
  if (!base) return "unset";
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${base}/api/v1/health`, { signal: ctl.signal });
    return r.ok ? "online" : "degraded";
  } catch {
    return "offline";
  } finally {
    clearTimeout(t);
  }
}

/** POST a telemetry record to the build's path. Returns false when offline/unset. */
export async function sendTelemetry(record: unknown, id?: ProductId): Promise<boolean> {
  const base = awsBase();
  if (!base) return false;
  try {
    const r = await fetch(`${base}${getProduct(id).telemetryPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
    });
    return r.ok;
  } catch {
    return false;
  }
}
