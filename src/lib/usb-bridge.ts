/**
 * Community shell stub — USB serial radio bridge.
 *
 * The production build talks to USB/OTG radio nodes (Web Serial) and
 * carries text frames onto the link bus. That carrier is licensed
 * technology and is NOT included in this community shell.
 * See LICENSE; API access: https://tinyradr.com
 */

export type UsbState = "idle" | "connecting" | "connected" | "error";

export function usbSupport(): boolean {
  return false;
}

export function connectUsb(): Promise<boolean> {
  return Promise.resolve(false);
}

export function disconnectUsb(): void {
  /* no-op */
}
