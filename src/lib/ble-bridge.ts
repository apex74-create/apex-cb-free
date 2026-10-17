/**
 * Community shell stub — BLE bridge.
 *
 * The production build pairs with an Apex bridge node over Bluetooth LE
 * and relays commands/frames onto the link bus. That carrier is licensed
 * technology and is NOT included in this community shell.
 * See LICENSE; API access: https://tinyradr.com
 */

export function bluetoothSupported(): boolean {
  return false;
}

export function connectApexBridge(): Promise<boolean> {
  return Promise.resolve(false);
}

export function sendCommand(_cmd: string): Promise<boolean> {
  return Promise.resolve(false);
}
