import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { hostInfo, type HostInfo } from "./host";

export type { SplashHost, HostInfo } from "./host";

/** Which app domain the visitor typed, read from the request so the right page paints first. */
export const getSplashHost = createServerFn({ method: "GET" }).handler(async (): Promise<HostInfo> => {
  return hostInfo(getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "");
});

/** Server: request header. Browser: window.location — no round trip on navigation. */
export async function resolveHost(): Promise<HostInfo> {
  if (typeof window !== "undefined") return hostInfo(window.location.host);
  return getSplashHost().catch(() => ({ app: null, prod: false }));
}
