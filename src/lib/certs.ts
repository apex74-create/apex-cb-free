/**
 * Dorito Triangle — bearing triangulator.
 *
 * Two things the operator asked for on top of the live feed:
 *  - SSL certificate assignment: paste a PEM, it is parsed and its real
 *    SHA-256 fingerprint computed with WebCrypto, then pinned to the mesh /
 *    bridge endpoint so TLS links can be verified.
 *  - Index paging: the bearing index can be long, so rows are paged.
 */

const CERT_KEY = "apex.dorito.certs";

export type CertAssignment = {
  id: string;
  /** where this cert applies: bridge agent, reticulum node, pcap http server */
  scope: "bridge" | "reticulum" | "pcap";
  subject: string;
  /** sha-256 of the DER body, colon-free hex */
  fingerprint: string;
  pem: string;
  addedAt: number;
};

export function loadCerts(): CertAssignment[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CERT_KEY) ?? "[]") as CertAssignment[];
  } catch {
    return [];
  }
}

export function saveCerts(certs: CertAssignment[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CERT_KEY, JSON.stringify(certs));
  } catch {
    /* storage locked */
  }
}

const PEM_RE = /-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/;

/** Strict PEM validation — rejects anything that is not a decodable DER body. */
export function parsePem(pem: string): Uint8Array | null {
  const m = PEM_RE.exec(pem.trim());
  if (!m?.[1]) return null;
  const b64 = m[1].replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length < 64) return null;
  try {
    const bin = atob(b64);
    const der = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    // DER certificates start with a SEQUENCE tag.
    return der[0] === 0x30 ? der : null;
  } catch {
    return null;
  }
}

/** Real SHA-256 fingerprint of the DER body — the value openssl prints. */
export async function fingerprint(der: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", der.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Pull the human-readable CN out of the DER by scanning for the commonName
 * OID (55 04 03) followed by a printable/UTF8 string. Good enough to label an
 * assignment without shipping a full X.509 parser to a watch.
 */
export function subjectCn(der: Uint8Array): string {
  for (let i = 0; i < der.length - 8; i += 1) {
    if (der[i] === 0x55 && der[i + 1] === 0x04 && der[i + 2] === 0x03) {
      const tag = der[i + 3];
      if (tag !== 0x13 && tag !== 0x0c) continue;
      const len = der[i + 4] ?? 0;
      const bytes = der.slice(i + 5, i + 5 + len);
      const s = new TextDecoder().decode(bytes).trim();
      if (s) return s;
    }
  }
  return "unnamed certificate";
}
