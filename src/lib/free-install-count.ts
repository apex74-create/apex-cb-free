/** Aggregate browser-confirmed PWA installs, not page visits or APK downloads. */
const RECEIPT_KEY = "apex.free-install-receipt";

/** Coarse, privacy-safe hints only: device class, language, broad region. */
function installHints(): { deviceClass: string; language: string; region: string } {
  const ua = navigator.userAgent;
  const deviceClass = /watch|wear/i.test(ua)
    ? "watch"
    : /mobi|android|iphone|ipad/i.test(ua)
      ? "phone"
      : "desktop";
  const language = (navigator.language || "").slice(0, 16);
  let region = "";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.startsWith("America/")) region = "Americas";
    else if (tz.startsWith("Europe/")) region = "Europe";
    else if (tz.startsWith("Asia/")) region = "Asia";
    else if (tz.startsWith("Africa/")) region = "Africa";
    else if (tz.startsWith("Australia/") || tz.startsWith("Pacific/")) region = "Pacific";
  } catch {
    // timezone unavailable — region stays blank
  }
  return { deviceClass, language, region };
}

export async function recordConfirmedFreeInstall(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    let receipt = localStorage.getItem(RECEIPT_KEY);
    if (!receipt) {
      receipt = crypto.randomUUID();
      localStorage.setItem(RECEIPT_KEY, receipt);
    }
    const hints = installHints();
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.rpc("record_free_install", {
      _receipt_id: receipt,
      _device_class: hints.deviceClass,
      _language: hints.language,
      _region: hints.region,
    });
    if (error) console.warn("Free install count unavailable", error.message);
    else window.dispatchEvent(new Event("apex-free-install-recorded"));
  } catch {
    // Installing must never depend on metrics or storage availability.
  }
}

export async function readConfirmedFreeInstalls(): Promise<number | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.rpc("free_install_count");
    return error || typeof data !== "number" ? null : data;
  } catch {
    return null;
  }
}
