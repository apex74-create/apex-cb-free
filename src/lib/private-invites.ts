/**
 * Community shell stub — recipient-bound private invitations.
 *
 * The production build issues device-bound ECDH invitations over a
 * digital-only invitation bus. That capability is licensed technology and
 * is NOT included in this community shell. See LICENSE; API access:
 * https://tinyradr.com
 */
import type { Room } from "@/lib/rooms";

export type InvitePeer = { id: string; call: string; pub: JsonWebKey };
export type IncomingInvite = { id: string; peerId: string; from: string; fingerprint: string; room: Room };

export function peerFingerprint(_pub: JsonWebKey): string {
  return "";
}

export function listenInvites(
  _roomId: string,
  _call: string,
  _onPeers: (peers: InvitePeer[]) => void,
  _onInvite: (invite: IncomingInvite) => void,
  _onAccepted: (room: Room) => void,
): () => void {
  return () => {};
}
