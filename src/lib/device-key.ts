/**
 * Device-bound licence key ("Apex fashion").
 *
 * Each browser mints a non-extractable ECDSA P-256 key pair kept in IndexedDB,
 * plus a signature hash over 6–16 device variables. The private key can never
 * be read out, so a copied app on another device cannot answer the server's
 * challenge and falls back to the free tier. This deters casual copying; it is
 * not tamper-proof against an expert.
 */
const DB = "apex-device-key";
const STORE = "keys";

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function get<T>(k: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((res) => {
    const q = db.transaction(STORE).objectStore(STORE).get(k);
    q.onsuccess = () => res(q.result as T);
    q.onerror = () => res(undefined);
  });
}

async function put(k: string, v: unknown) {
  const db = await idb();
  await new Promise<void>((res) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).put(v, k);
    t.oncomplete = () => res();
    t.onerror = () => res();
  });
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

/** Device variables: at least 6, at most 16, whatever this browser exposes. */
export function deviceVariables(): string[] {
  const n = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
  const vars = [
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
    String(window.devicePixelRatio),
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency ?? ""),
    String(n.deviceMemory ?? ""),
    n.userAgentData?.platform ?? navigator.platform ?? "",
    String(navigator.maxTouchPoints ?? 0),
    navigator.userAgent.replace(/[\d.]+/g, ""),
  ];
  return vars.slice(0, 16);
}

async function sha256(s: string) {
  return b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

type Stored = { pair: CryptoKeyPair; pub: string };

async function keyPair(): Promise<Stored> {
  const have = await get<Stored>("main");
  if (have?.pair?.privateKey) return have;
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const pub = b64(await crypto.subtle.exportKey("spki", pair.publicKey));
  const rec = { pair, pub };
  await put("main", rec);
  return rec;
}

export type DeviceProof = { pub: string; sigHash: string; ts: number; sig: string };

/** Sign `userId|ts|sigHash` with the device's private key. */
export async function deviceProof(userId: string): Promise<DeviceProof | null> {
  try {
    if (typeof indexedDB === "undefined" || !crypto?.subtle) return null;
    const { pair, pub } = await keyPair();
    const sigHash = await sha256(deviceVariables().join("|"));
    const ts = Date.now();
    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode(`${userId}|${ts}|${sigHash}`),
    );
    return { pub, sigHash, ts, sig: b64(sig) };
  } catch {
    return null;
  }
}
