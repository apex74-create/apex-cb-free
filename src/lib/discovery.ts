/**
 * Community shell stub — local agent discovery.
 *
 * The production build discovers companion nodes on the local network and
 * hands them work. That capability is licensed technology and is NOT
 * included in this community shell. See LICENSE; API access:
 * https://tinyradr.com
 */

export type FoundAgent = { url: string; name?: string };

export function insecureBlocked(): boolean {
  return false;
}

export function buildCandidates(): string[] {
  return [];
}

export function discoverAgents(): Promise<FoundAgent[]> {
  return Promise.resolve([]);
}
