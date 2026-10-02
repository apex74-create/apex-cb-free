/**
 * Reticulum mesh controller.
 *
 * The watch drives a real Reticulum stack running on the paired Android phone
 * (rnsd + LXMF inside Termux) through the ADB bridge. Every value the UI shows
 * is parsed from actual `rnstatus` / `rnpath` output or from the JSONL inbox
 * written by the netchat helper — nothing is generated locally.
 *
 * Phone-side prerequisites (see agent/reticulum/README.md):
 *   pkg install python && pip install rns lxmf
 *   rnsd -d                      # Reticulum daemon
 *   python netchat.py listen     # LXMF inbox -> /sdcard/apex/inbox.jsonl
 */

export const TERMUX_PKG = "com.termux";
export const SPOOL = "/sdcard/apex";
export const INBOX = `${SPOOL}/inbox.jsonl`;
export const OUTBOX = `${SPOOL}/outbox.jsonl`;
export const HELPER = "/data/data/com.termux/files/home/netchat.py";
const BIN = "/data/data/com.termux/files/usr/bin";

const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * Run a command inside Termux's environment in the background.
 * Termux's RunCommandService is the documented way to execute from outside.
 */
export function termux(cmd: string): string {
  return [
    "shell am startservice -n com.termux/com.termux.app.RunCommandService",
    "-a com.termux.RUN_COMMAND",
    `--es com.termux.RUN_COMMAND_PATH ${BIN}/bash`,
    `--esa com.termux.RUN_COMMAND_ARGUMENTS -c,${sh(cmd)}`,
    "--ez com.termux.RUN_COMMAND_BACKGROUND true",
  ].join(" ");
}

/** Run a Reticulum tool and capture stdout to a spool file we can read back. */
export function capture(name: string, cmd: string): string {
  return termux(`mkdir -p ${SPOOL}; ${cmd} > ${SPOOL}/${name}.out 2>&1`);
}

export const readSpool = (name: string) => `shell cat ${SPOOL}/${name}.out 2>/dev/null || echo ''`;

export const CMD = {
  termuxInstalled: `shell pm path ${TERMUX_PKG}`,
  rnsdAlive: `shell ps -A -o CMD 2>/dev/null | grep -c rnsd || echo 0`,
  status: () => capture("rnstatus", "rnstatus -A"),
  paths: () => capture("rnpath", "rnpath -t"),
  identity: () => capture("ident", `python ${HELPER} identity`),
  startNode: () => termux("rnsd -d"),
  startListener: () =>
    termux(`mkdir -p ${SPOOL}; nohup python ${HELPER} listen >> ${SPOOL}/listen.log 2>&1 &`),
  announce: () => capture("announce", `python ${HELPER} announce`),
  inbox: `shell tail -n 80 ${INBOX} 2>/dev/null || echo ''`,
  clearInbox: `shell : > ${INBOX}`,
};

/** Send one signed LXMF message. `payload` is JSON produced by the token ledger. */
export function sendCmd(destHash: string, payload: string): string {
  return capture("send", `python ${HELPER} send ${sh(destHash)} ${sh(payload)}`);
}

export type Iface = { name: string; status: string; rate: string; traffic: string };

/** Parse `rnstatus` blocks into real interface rows. */
export function parseStatus(out: string): Iface[] {
  const blocks = out.split(/\n(?=\S)/).filter((b) => b.trim());
  const rows: Iface[] = [];
  for (const b of blocks) {
    const lines = b.split("\n");
    const head = (lines[0] ?? "").trim();
    if (!head || head.startsWith("Shared") || head.startsWith("Traceback")) continue;
    const status = /Status\s*:\s*(.+)/.exec(b)?.[1]?.trim() ?? "";
    const rate = /Rate\s*:\s*(.+)/.exec(b)?.[1]?.trim() ?? "";
    const rx = /Traffic\s*:\s*([^\n]+)/.exec(b)?.[1]?.trim() ?? "";
    if (!status && !rate && !rx) continue;
    rows.push({ name: head.replace(/:$/, ""), status, rate, traffic: rx });
  }
  return rows;
}

export type Path = { hash: string; via: string; hops: number };

/** Parse `rnpath -t` table rows: <hash> via <iface> N hops */
export function parsePaths(out: string): Path[] {
  return out
    .split("\n")
    .map((l) => l.trim())
    .map((l) => {
      const m = /^([0-9a-f]{16,})\s+.*?via\s+(\S+).*?(\d+)\s+hop/i.exec(l);
      if (!m) return null;
      return { hash: m[1]!, via: m[2]!, hops: Number(m[3]) };
    })
    .filter((p): p is Path => p !== null);
}

export function parseIdentity(out: string): string | null {
  const m = /([0-9a-f]{32})/i.exec(out);
  return m?.[1] ?? null;
}

export type InboxMsg = {
  ts: number;
  from: string;
  title?: string;
  content: string;
  /** raw token envelope when the sender attached one */
  token?: unknown;
};

/** The listener writes one JSON object per line — parse defensively. */
export function parseInbox(out: string): InboxMsg[] {
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("{"))
    .map((l) => {
      try {
        const o = JSON.parse(l) as Partial<InboxMsg>;
        if (!o.content && !o.title) return null;
        return {
          ts: Number(o.ts) || Date.now(),
          from: String(o.from ?? "unknown"),
          title: o.title,
          content: String(o.content ?? ""),
          // older listeners wrote this field under the previous name
          token: o.token ?? (o as { coin?: unknown }).coin,
        } as InboxMsg;
      } catch {
        return null;
      }
    })
    .filter((m): m is InboxMsg => m !== null);
}

const PEER_KEY = "apex.reticulum.peers";
export type Peer = { name: string; hash: string };

export function loadPeers(): Peer[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(PEER_KEY) ?? "[]") as Peer[];
  } catch {
    return [];
  }
}

export function savePeers(peers: Peer[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PEER_KEY, JSON.stringify(peers));
  } catch {
    /* storage locked */
  }
}

/** LXMF destination hashes are 32 hex chars. */
export const isDestHash = (v: string) => /^[0-9a-f]{32}$/i.test(v.trim());
