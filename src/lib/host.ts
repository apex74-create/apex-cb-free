/**
 * Which of the three domains a visitor is on. Pure and browser-safe, so the
 * server (request header) and the client (window.location) agree on the
 * first paint and every later navigation without a network hop.
 */
export type SplashHost = "mesh" | "cb" | "shield" | null;
export type HostInfo = { app: SplashHost; prod: boolean };

export function hostInfo(raw: string): HostInfo {
  const host = (raw.split(",")[0] ?? "").trim().split(":")[0]!.toLowerCase().replace(/^www\./, "");
  if (host === "castnetmesh.com") return { app: "mesh", prod: true };
  if (host === "encryptedcb.com") return { app: "cb", prod: true };
  if (host === "apexsignalshield.com") return { app: "shield", prod: true };
  return { app: null, prod: host === "tinyradr.com" || host === "tinyradr.lovable.app" };
}

/** Install manifest per domain: each domain installs its own app. */
export function manifestFor(app: SplashHost, cbPage: boolean): string {
  if (app === "cb") return "/encryptedcb.webmanifest";
  if (app === "mesh") return "/castnetmesh.webmanifest";
  if (app === "shield") return "/shield.webmanifest";
  return cbPage ? "/cb.webmanifest" : "/manifest.webmanifest";
}
