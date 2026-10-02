/**
 * CB carrier selection — instant fallback when the network drops.
 *
 * The CB deck must never depend on one transport. When network_state goes
 * to "not connected" the deck picks the best local path immediately, in
 * this order:
 *
 *  1. relay   — cloud realtime bus (needs internet; default when online)
 *  2. hotspot — the phone's own SoftAP self-node: peers join the AP, no
 *               uplink needed (Reticulum AutoInterface + TCP server)
 *  3. ble     — direct Bluetooth link to the paired handset (short range,
 *               no AP at all)
 *  4. lora    — RNode over USB-OTG, 1–15 km, fully licence-free
 *
 * No typing, no terminal: selection is automatic from live signals
 * (navigator.onLine, bridge state, BLE link state, mesh node state).
 */

import { useSyncExternalStore } from "react";

export type CbCarrier = "relay" | "mesh" | "hotspot" | "usb" | "ble" | "lora";

export type CarrierState = {
  /** which carrier the deck should use right now */
  active: CbCarrier;
  /** why this carrier was picked, one short line for the UI */
  reason: string;
  online: boolean;
  /** carriers that are actually usable right now, best first */
  available: CbCarrier[];
};

export const CARRIER_LABEL: Record<CbCarrier, string> = {
  relay: "CLOUD RELAY",
  mesh: "FIELD MESH",
  usb: "USB RADIO",
  hotspot: "SELF-NODE HOTSPOT",
  ble: "BLUETOOTH DIRECT",
  lora: "LORA RNODE",
};

export type CarrierSignals = {
  /** bridge link to the phone agent is up (hotspot/lora config possible) */
  bridgeUp: boolean;
  /** BLE GATT link to the handset is live */
  bleUp: boolean;
  /** Reticulum node attached and running on the phone */
  meshUp: boolean;
  /** an RNode is actually attached (user-confirmed or detected) */
  loraAttached: boolean;
  /** phones linked directly over local Wi-Fi (no server) */
  fieldMesh?: boolean;
  /** radio node on the USB cable */
  usbUp?: boolean;
};

/** Pure pick — testable, no browser APIs. */
export function pickCarrier(online: boolean, s: CarrierSignals): CarrierState {
  const available: CbCarrier[] = [];
  if (online) available.push("relay");
  if (s.fieldMesh) available.push("mesh");
  if (s.bridgeUp || s.meshUp) available.push("hotspot");
  if (s.usbUp) available.push("usb");
  if (s.bleUp) available.push("ble");
  if (s.loraAttached) available.push("lora");

  if (available.length === 0) {
    return {
      active: "hotspot",
      reason: online
        ? "relay unreachable — start the phone self-node"
        : "network down — start the phone self-node or pair Bluetooth",
      online,
      available,
    };
  }
  const active = available[0]!;
  const reason =
    active === "relay"
      ? "online — cloud relay"
      : active === "mesh"
        ? "no internet — phones linked directly, encrypted"
        : active === "usb"
          ? "no internet — radio node on the USB cable"
      : active === "hotspot"
        ? "network down — phone self-node, peers join your AP"
        : active === "ble"
          ? "network down — Bluetooth direct to handset"
          : "network down — LoRa radio, no infrastructure at all";
  return { active, reason, online, available };
}

/* ---- live network_state watcher -------------------------------------- */

let onlineNow = typeof navigator === "undefined" ? true : navigator.onLine;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    onlineNow = true;
    emit();
  });
  window.addEventListener("offline", () => {
    onlineNow = false;
    emit();
  });
}

export function isOnline(): boolean {
  return onlineNow;
}

/** React hook: true/false live network_state, re-renders on change. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => onlineNow,
    () => true,
  );
}
