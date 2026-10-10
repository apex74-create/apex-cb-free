import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useActiveLinks } from "@/lib/cb-links";
import { CARRIER_LABEL, pickCarrier, useOnline } from "@/lib/cb-carrier";
import { useBridge } from "@/lib/bridge-hooks";
import { getMeshStatus, meshLive, subscribeMesh, type MeshStatus } from "@/lib/mesh-status";

/**
 * One-line carrier readout for the CB deck. Watches network_state and the
 * local links; the moment the network drops it names the best local path
 * (self-node hotspot → Bluetooth → LoRa) instead of just saying "down".
 * Push button and go — the user never types anything.
 */
export function CbCarrierBanner() {
  const online = useOnline();
  const { state } = useBridge();
  const router = useRouter();
  const [mesh, setMesh] = useState<MeshStatus>(() => getMeshStatus());

  useEffect(() => subscribeMesh(setMesh), []);

  // Warm the offline fallback pages while we still have internet, so the
  // banner links below keep working after the network drops (their code
  // chunks get cached by the service worker on first fetch).
  useEffect(() => {
    if (!online) return;
    void router.preloadRoute({ to: "/bridge" }).catch(() => {});
    void router.preloadRoute({ to: "/netchat" }).catch(() => {});
  }, [online, router]);

  const links = useActiveLinks();
  const carrier = pickCarrier(online, {
    bridgeUp: state === "online",
    bleUp: false, // BLE link state lives on /bridge; deck treats it as unknown
    meshUp: meshLive(mesh),
    loraAttached: false,
    fieldMesh: links.includes("mesh"),
    usbUp: links.includes("usb"),
  });

  const tone = carrier.active === "relay" ? "text-signal" : "text-warn";

  return (
    <div className="cb-carrier-banner z-10 shrink-0 border-b border-border face-pad py-1">
      <span className={`block truncate text-[18px] uppercase tracking-widest ${tone}`}>
        carrier: {CARRIER_LABEL[carrier.active]} · {carrier.reason}
      </span>
      {!online && carrier.available.length === 0 && (
        <span className="mt-0.5 block text-[16px] uppercase tracking-widest text-alert">
          no local path yet —{" "}
          <Link to="/bridge" className="underline">
            start the phone self-node
          </Link>{" "}
          or{" "}
          <Link to="/netchat" className="underline">
            open mesh
          </Link>
        </span>
      )}
    </div>
  );
}
