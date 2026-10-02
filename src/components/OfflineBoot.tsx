import { useEffect, useState } from "react";
import { registerServiceWorker } from "../lib/register-sw";

/**
 * Registers the offline worker (watch-critical shell caching) and shows a thin
 * banner only when the device is genuinely offline.
 */
export default function OfflineBoot() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    void registerServiceWorker();
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[9999] bg-warn/90 px-2 py-0.5 text-center text-[8px] font-bold uppercase tracking-[0.18em] text-background"
    >
      offline — live tools unavailable
    </div>
  );
}
