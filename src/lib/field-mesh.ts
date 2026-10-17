/**
 * Community shell stub — field mesh carrier.
 *
 * The production build pairs phones over a local encrypted mesh (invite
 * codes, AES-GCM frames, daisy-chain relay across links). That
 * handset-to-handset chain is licensed technology and is NOT included in
 * this community shell. See LICENSE; API access: https://tinyradr.com
 */

export function meshSupported(): boolean {
  return false;
}

export function createInvite(_call: string): Promise<{ code: string } | null> {
  return Promise.resolve(null);
}

export function answerInvite(_code: string, _call: string): Promise<boolean> {
  return Promise.resolve(false);
}

export function leaveMesh(): void {
  /* no-op */
}

export function onPeerCount(cb: (n: number) => void): () => void {
  cb(0);
  return () => {};
}
