/**
 * Root-to-leaf filesystem view.
 *
 * Android hides most of the tree from you: the file manager shows a curated
 * sandbox and everything else simply does not appear. Unreadable is one thing —
 * invisible is another. This walker lists every entry the kernel admits to,
 * all the way to `/`, and where a directory cannot be opened it still shows the
 * node with an honest state instead of silently dropping it.
 *
 * Reads only. Nothing here writes, deletes, moves or uploads.
 */

export type NodeState =
  /** Listed and readable. */
  | "open"
  /** Exists, kernel confirms it, contents refused without root. */
  | "denied"
  /** Named in the map but the path is not present on this device. */
  | "absent"
  /** Not probed yet. */
  | "unknown";

export type FsEntry = {
  name: string;
  path: string;
  dir: boolean;
  link: string | null;
  perms: string;
  owner: string;
  group: string;
  size: number;
  modified: string;
  state: NodeState;
};

export type DirListing = {
  path: string;
  state: NodeState;
  entries: FsEntry[];
  /** Raw refusal text when the kernel said no, shown verbatim rather than hidden. */
  refusal: string | null;
};

const DENIED = /permission denied|operation not permitted|access denied|eacces/i;
const ABSENT = /no such file or directory|enoent/i;

export function joinPath(base: string, name: string): string {
  if (name.startsWith("/")) return name;
  return base === "/" ? `/${name}` : `${base}/${name}`;
}

export function parentPath(path: string): string {
  if (path === "/" || path === "") return "/";
  const cut = path.replace(/\/+$/, "").lastIndexOf("/");
  return cut <= 0 ? "/" : path.slice(0, cut);
}

/** Split a path into tappable crumbs, root first. */
export function crumbs(path: string): Array<{ label: string; path: string }> {
  const parts = path.split("/").filter(Boolean);
  const out = [{ label: "/", path: "/" }];
  let acc = "";
  for (const p of parts) {
    acc += `/${p}`;
    out.push({ label: p, path: acc });
  }
  return out;
}

/**
 * Parse one `ls -la` line from Android's toybox.
 *   drwxr-xr-x  4 root root 4096 2026-09-22 11:04 data
 *   lrwxrwxrwx  1 root root   11 2026-01-01 00:00 sdcard -> /storage/self/primary
 */
export function parseLsLine(line: string, base: string): FsEntry | null {
  const trimmed = line.trim();
  if (!trimmed || /^total\s/i.test(trimmed)) return null;
  const m =
    /^([bcdlprsw-][rwxsStTl-]{9}[.+]?)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+(?:\s+\S+)?)\s+(.+)$/.exec(
      trimmed,
    );
  if (!m) return null;
  const [, perms, , owner, group, sizeRaw, modified, rest] = m;
  let name = rest!;
  let link: string | null = null;
  const arrow = name.indexOf(" -> ");
  if (arrow !== -1) {
    link = name.slice(arrow + 4);
    name = name.slice(0, arrow);
  }
  if (name === "." || name === "..") return null;
  const kind = perms![0];
  return {
    name,
    path: joinPath(base, name),
    dir: kind === "d" || (kind === "l" && !!link && !/\.\w{1,5}$/.test(link)),
    link,
    perms: perms!,
    owner: owner!,
    group: group!,
    size: Number(sizeRaw),
    modified: modified!,
    state: "unknown",
  };
}

/** Turn raw `ls -la` output for one directory into a listing. */
export function parseListing(path: string, raw: string): DirListing {
  const text = raw ?? "";
  if (ABSENT.test(text) && !/\n/.test(text.trim())) {
    return { path, state: "absent", entries: [], refusal: text.trim() };
  }
  const lines = text.split(/\r?\n/);
  const entries: FsEntry[] = [];
  const refusals: string[] = [];
  for (const line of lines) {
    if (DENIED.test(line) || ABSENT.test(line)) {
      refusals.push(line.trim());
      continue;
    }
    const entry = parseLsLine(line, path);
    if (entry) entries.push(entry);
  }
  entries.sort((a, b) =>
    a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1,
  );
  if (entries.length === 0 && refusals.length > 0) {
    return { path, state: "denied", entries: [], refusal: refusals[0]! };
  }
  return {
    path,
    state: "open",
    entries,
    // Partial refusals matter: a listing can succeed while individual children
    // are withheld. Surface that rather than pretending the view is complete.
    refusal: refusals.length > 0 ? `${refusals.length} entries withheld` : null,
  };
}

/**
 * The parts of Android that the file manager will never show you. Listed here
 * so they appear in the tree even when the kernel refuses to open them: you
 * can see the door and be told it is locked.
 */
export const HIDDEN_ROOTS: Array<{ path: string; why: string }> = [
  { path: "/", why: "the actual root — everything hangs off this" },
  { path: "/data", why: "every app's private storage; root-only" },
  { path: "/data/data", why: "per-package databases and preferences" },
  { path: "/data/system", why: "accounts, locksettings, package registry" },
  { path: "/data/misc", why: "wifi configs, keystore, radio state" },
  { path: "/system", why: "the read-only OS image" },
  { path: "/vendor", why: "chipset blobs and radio firmware" },
  { path: "/proc", why: "live kernel and process state" },
  { path: "/sys", why: "hardware and driver knobs" },
  { path: "/dev", why: "device nodes, including the radio interfaces" },
  { path: "/config", why: "kernel configfs" },
  { path: "/efs", why: "IMEI and calibration partition on some vendors" },
  { path: "/persist", why: "sensor calibration, DRM keys" },
  { path: "/cache", why: "OTA and recovery scratch space" },
  { path: "/storage/emulated/0", why: "your own files, as the app sees them" },
  { path: "/storage/emulated/0/Android/data", why: "hidden from you since Android 11" },
];

/** Shell one-liner for a directory listing, refusals kept on stdout. */
export function listCmd(path: string): string {
  return `shell ls -la -A ${shellQuote(path)} 2>&1`;
}

/** Shell one-liner that confirms a node exists even when it cannot be opened. */
export function statCmd(path: string): string {
  return `shell ls -ld ${shellQuote(path)} 2>&1`;
}

export function shellQuote(path: string): string {
  return `'${path.replace(/'/g, `'\\''`)}'`;
}

/** Classify a `ls -ld` probe of a single node. */
export function probeState(raw: string): NodeState {
  if (!raw || !raw.trim()) return "unknown";
  if (ABSENT.test(raw)) return "absent";
  if (DENIED.test(raw)) return "denied";
  return "open";
}
