/**
 * Passive, receive-only public-channel scan. Private rooms are never scanned.
 *
 * Nested block scanner: the shell walks blocks of BLOCK_SIZE channels
 * (1-20, 21-40, 41-60…). Each block sub-scanner listens to all of its
 * channels at once for one dwell, so a hit anywhere in the block hot-lights
 * the exact channel instantly. For large licences the blocks group into a
 * tree (20 blocks → one 400-channel group, and so on) and every hit reports
 * up the chain as a path, e.g. [group 1, block 3, channel 47].
 */
import { supabase } from "@/integrations/supabase/client";
import { onLinkFrame, type LinkFrame } from "@/lib/cb-links";
import { CB_MAX, CB_MIN } from "@/lib/channels";
import { roomBusName } from "@/lib/rooms";
import type { PttTx } from "@/lib/ptt";

export const BLOCK_SIZE = 20;
const DWELL_MS = 1600;
/** Measured-ish cost to open a block's listeners before the dwell starts. */
const JOIN_MS = 500;
/** One live connection carries ~100 channel listeners; 10 stay reserved for the tuned channel, invites and links. */
export const MAX_BLOCK = 90;
/**
 * Efficiency ceiling: one device must sweep every block within one
 * maximum key-up (8 s), or a transmission can start and end unseen.
 *   blocks per sweep = floor(8000 / (1600 + 500)) = 3
 *   ceiling          = 3 × 90 = 270 channels per scanning device
 * Above that, the plan splits into operator groups (assignScanGroups).
 */
export const SWEEP_BUDGET_MS = 8000;
export const BLOCKS_PER_SWEEP = Math.floor(SWEEP_BUDGET_MS / (DWELL_MS + JOIN_MS));
export const SCAN_CEILING = BLOCKS_PER_SWEEP * MAX_BLOCK;

/** Smallest block size (≥ 20) that still sweeps `total` inside the budget. */
export function blockSizeFor(total: number): number {
  return Math.min(MAX_BLOCK, Math.max(BLOCK_SIZE, Math.ceil(Math.min(total, SCAN_CEILING) / BLOCKS_PER_SWEEP)));
}

/** Split a large licence into per-operator scan ranges, each within the ceiling. */
export function assignScanGroups(total: number): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (let from = CB_MIN; from <= total; from += SCAN_CEILING) out.push({ from, to: Math.min(total, from + SCAN_CEILING - 1) });
  return out;
}

export type ScanBlock = { index: number; from: number; to: number };

/** Split 1..total into fixed blocks. */
export function scanBlocks(total = CB_MAX, size = BLOCK_SIZE): ScanBlock[] {
  const out: ScanBlock[] = [];
  for (let from = CB_MIN, i = 0; from <= total; from += size, i++) out.push({ index: i, from, to: Math.min(total, from + size - 1) });
  return out;
}

/** Report path for a channel up the tree: [top group … block, channel]. */
export function scanPath(channel: number, total = CB_MAX, size = BLOCK_SIZE): number[] {
  const path = [channel];
  let unit = size;
  let idx = Math.floor((channel - CB_MIN) / unit);
  path.unshift(idx + 1);
  while (unit * size < total) {
    unit *= size;
    idx = Math.floor((channel - CB_MIN) / unit);
    path.unshift(idx + 1);
  }
  return path;
}

export type ScanOptions = { total?: number; blockSize?: number; onBlock?: (block: ScanBlock) => void };

export function scanPublicChannels(
  start: number,
  onStep: (channel: number) => void,
  onHit: (channel: number, tx: PttTx) => void,
  opts: ScanOptions = {},
) {
  const total = Math.min(opts.total ?? CB_MAX, SCAN_CEILING);
  const blocks = scanBlocks(total, opts.blockSize ?? blockSizeFor(total));
  let stopped = false;
  let bi = blocks.findIndex((b) => start >= b.from && start <= b.to);
  bi = (bi < 0 ? 0 : bi) - 1;
  let block = blocks[0]!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let subs: ReturnType<typeof supabase.channel>[] = [];

  const clear = () => {
    if (timer) clearTimeout(timer);
    subs.forEach((s) => void supabase.removeChannel(s));
    subs = [];
  };
  const hit = (ch: number, tx: PttTx) => {
    if (stopped) return;
    stopped = true;
    clear();
    onStep(ch);
    onHit(ch, tx);
  };
  const inBlock = (ch: unknown): ch is number => typeof ch === "number" && ch >= block.from && ch <= block.to;

  const next = () => {
    if (stopped) return;
    clear();
    bi = (bi + 1) % blocks.length;
    block = blocks[bi]!;
    opts.onBlock?.(block);
    onStep(block.from);
    let ready = 0;
    const size = block.to - block.from + 1;
    const mine = block;
    for (let ch = block.from; ch <= block.to; ch++) {
      const listening = supabase.channel(roomBusName(String(ch)), { config: { broadcast: { self: false } } });
      subs.push(listening);
      listening.on("broadcast", { event: "tx" }, ({ payload }) => {
        if (stopped || mine !== block) return;
        const tx = payload as Partial<PttTx> & { roomId?: string; digitalOnly?: boolean };
        if (!tx?.body || tx.body.startsWith("E1:") || tx.digitalOnly || tx.ch !== ch || (tx.roomId && tx.roomId !== String(ch))) return;
        hit(ch, tx as PttTx);
      });
      listening.subscribe((status) => {
        if (stopped || mine !== block) return;
        if (status === "SUBSCRIBED" && ++ready === size) timer = setTimeout(next, DWELL_MS);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (timer) clearTimeout(timer);
          timer = setTimeout(next, 500);
        }
      });
    }
  };

  const offLink = onLinkFrame((frame: LinkFrame) => {
    if (stopped || frame.digitalOnly || !frame.body || frame.body.startsWith("E1:") || !inBlock(frame.ch) || (frame.roomId && frame.roomId !== String(frame.ch))) return;
    hit(frame.ch, { ...frame, tag: `APEX-${String(frame.ch).padStart(2, "0")}` });
  });
  next();
  return () => {
    stopped = true;
    clear();
    offLink();
  };
}
