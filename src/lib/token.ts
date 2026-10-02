/**
 * Sovereign chat token controller.
 *
 * Every netchat message is paid for with a token from a locally sovereign
 * ledger: an ECDSA P-256 keypair held on the watch (WebCrypto, no server, no
 * custodian) plus a SHA-256 hash chain. Each entry is signed over the previous
 * entry's hash, so the chain is tamper-evident and any receiver can verify it
 * from the public key alone. This is cryptographic signing, not a scoreboard.
 *
 * Storage keys use the `apex.token.*` prefix. Ledgers saved under the older
 * `apex.coin.*` prefix are migrated once, on first load, so nothing is lost.
 * The hash preimage and signature scheme are unchanged.
 */

const KEY_PRIV = "apex.token.priv";
const KEY_PUB = "apex.token.pub";
const KEY_CHAIN = "apex.token.chain";

const LEGACY = {
  [KEY_PRIV]: "apex.coin.priv",
  [KEY_PUB]: "apex.coin.pub",
  [KEY_CHAIN]: "apex.coin.chain",
} as const;

/** One-time move of any pre-rename ledger onto the current keys. */
function migrateLegacyKeys() {
  if (typeof window === "undefined") return;
  try {
    const store = window.localStorage;
    for (const [key, legacy] of Object.entries(LEGACY)) {
      if (store.getItem(key) === null) {
        const old = store.getItem(legacy);
        if (old !== null) store.setItem(key, old);
      }
    }
  } catch {
    /* storage unavailable */
  }
}

export type TokenEntry = {
  seq: number;
  ts: number;
  /** mint = issuance to self, spend = payment for a message, recv = credited */
  kind: "mint" | "spend" | "recv";
  amount: number;
  /** counterparty destination hash, or "self" */
  peer: string;
  /** sha-256 of the previous entry, hex */
  prev: string;
  /** sha-256 of this entry's canonical body, hex */
  hash: string;
  /** base64 ECDSA P-256 signature over `hash` */
  sig: string;
};

const enc = new TextEncoder();

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

const ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_ALG = { name: "ECDSA", hash: "SHA-256" } as const;

/** Load the sovereign key, generating and persisting one on first run. */
export async function getKeys(): Promise<{ priv: CryptoKey; pub: CryptoKey; pubHex: string }> {
  migrateLegacyKeys();
  const store = window.localStorage;
  let privJwk = store.getItem(KEY_PRIV);
  let pubJwk = store.getItem(KEY_PUB);
  if (!privJwk || !pubJwk) {
    const pair = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
    privJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
    pubJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey));
    store.setItem(KEY_PRIV, privJwk);
    store.setItem(KEY_PUB, pubJwk);
  }
  const priv = await crypto.subtle.importKey("jwk", JSON.parse(privJwk), ALG, false, ["sign"]);
  const pub = await crypto.subtle.importKey("jwk", JSON.parse(pubJwk), ALG, true, ["verify"]);
  const raw = await crypto.subtle.exportKey("raw", pub);
  return { priv, pub, pubHex: hex(raw) };
}

/** Short, stable wallet address derived from the public key. */
export async function walletAddress(pubHex: string): Promise<string> {
  return (await sha256(pubHex)).slice(0, 16);
}

export function loadChain(): TokenEntry[] {
  if (typeof window === "undefined") return [];
  migrateLegacyKeys();
  try {
    return JSON.parse(window.localStorage.getItem(KEY_CHAIN) ?? "[]") as TokenEntry[];
  } catch {
    return [];
  }
}

function saveChain(chain: TokenEntry[]) {
  window.localStorage.setItem(KEY_CHAIN, JSON.stringify(chain.slice(-500)));
}

const body = (e: Omit<TokenEntry, "hash" | "sig">) =>
  `${e.seq}|${e.ts}|${e.kind}|${e.amount}|${e.peer}|${e.prev}`;

/** Append a signed entry to the chain and persist it. */
export async function append(
  kind: TokenEntry["kind"],
  amount: number,
  peer: string,
): Promise<TokenEntry> {
  const { priv } = await getKeys();
  const chain = loadChain();
  const last = chain[chain.length - 1];
  const draft = {
    seq: (last?.seq ?? -1) + 1,
    ts: Date.now(),
    kind,
    amount,
    peer,
    prev: last?.hash ?? "genesis",
  };
  const hash = await sha256(body(draft));
  const sig = b64(await crypto.subtle.sign(SIGN_ALG, priv, enc.encode(hash)));
  const entry: TokenEntry = { ...draft, hash, sig };
  saveChain([...chain, entry]);
  return entry;
}

export function balance(chain: TokenEntry[] = loadChain()): number {
  return chain.reduce((n, e) => n + (e.kind === "spend" ? -e.amount : e.amount), 0);
}

/** Recompute every hash and check every signature. Returns the first bad seq. */
export async function verifyChain(
  chain: TokenEntry[] = loadChain(),
): Promise<{ ok: boolean; badSeq?: number }> {
  const { pub } = await getKeys();
  let prev = "genesis";
  for (const e of chain) {
    if (e.prev !== prev) return { ok: false, badSeq: e.seq };
    const hash = await sha256(body(e));
    if (hash !== e.hash) return { ok: false, badSeq: e.seq };
    const ok = await crypto.subtle.verify(SIGN_ALG, pub, unb64(e.sig), enc.encode(e.hash));
    if (!ok) return { ok: false, badSeq: e.seq };
    prev = e.hash;
  }
  return { ok: true };
}

/** Envelope attached to an outgoing mesh message so the receiver can verify it. */
export async function envelope(text: string, peer: string, fee: number) {
  const { pubHex } = await getKeys();
  const entry = await append("spend", fee, peer);
  return {
    v: 1,
    from: await walletAddress(pubHex),
    pub: pubHex,
    fee,
    entry,
    text,
  };
}

/** Credit received value — the counterpart of a peer's spend. */
export async function credit(amount: number, peer: string) {
  return append("recv", amount, peer);
}

/** Bootstrap issuance: sovereign nodes mint their own working float. */
export async function mint(amount: number) {
  return append("mint", amount, "self");
}
