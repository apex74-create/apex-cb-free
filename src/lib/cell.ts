/**
 * Cell tower layer.
 *
 * Everything here is parsed out of real `adb shell dumpsys telephony.registry`
 * output (the same source the Android radio UI uses). Tower coordinates come
 * from BeaconDB (https://beacondb.net), a free, open, key-less rebuild of the
 * Mozilla Location Service that speaks the documented `/v1/geolocate` API.
 */

/** Full radio dump — contains CellInfo* blocks for serving + neighbour cells. */
export const cellDumpCmd = `shell dumpsys telephony.registry`;
/** Cheaper poll: the operator/service-state line only. */
export const serviceStateCmd = `shell dumpsys telephony.registry | grep -m1 mServiceState`;

export type Radio = "lte" | "nr" | "gsm" | "wcdma" | "tdscdma";

export type CellRecord = {
  radio: Radio;
  registered: boolean;
  mcc: number | null;
  mnc: number | null;
  /** Cell id (CI / CID / NCI) */
  ci: number | null;
  /** Tracking / location area code */
  tac: number | null;
  pci: number | null;
  earfcn: number | null;
  /** dBm — rsrp for LTE/NR, rssi for 2G/3G */
  dbm: number | null;
  /** dB — rsrq where the radio reports it */
  quality: number | null;
  /** 0-4 bars as Android grades it */
  level: number | null;
  operator: string | null;
};

const num = (block: string, key: string): number | null => {
  const m = block.match(new RegExp(`\\b${key}\\s*=\\s*(-?\\d+)`));
  if (!m) return null;
  const v = Number(m[1]);
  // Android prints Integer.MAX_VALUE / 2147483647 for "unavailable".
  return !Number.isFinite(v) || Math.abs(v) === 2147483647 ? null : v;
};

const RADIO_RE = /CellInfo(Lte|Nr|Gsm|Wcdma|Tdscdma)\s*:?\s*\{/gi;

/**
 * Split the dump into CellInfo blocks by brace balance, so nested
 * CellIdentity/CellSignalStrength objects stay with their parent.
 */
function cellBlocks(raw: string): { radio: Radio; body: string }[] {
  const out: { radio: Radio; body: string }[] = [];
  RADIO_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RADIO_RE.exec(raw))) {
    const start = raw.indexOf("{", m.index);
    if (start === -1) continue;
    let depth = 0;
    let end = start;
    for (let i = start; i < raw.length; i += 1) {
      const c = raw[i];
      if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    out.push({ radio: m[1]!.toLowerCase() as Radio, body: raw.slice(start, end + 1) });
    RADIO_RE.lastIndex = end;
  }
  return out;
}

export function parseCells(raw: string): CellRecord[] {
  const operator = raw.match(/mOperatorAlphaLong\s*=\s*([^\s,}]+)/)?.[1] ?? null;
  const cells = cellBlocks(raw).map(({ radio, body }) => {
    const dbm = num(body, "rsrp") ?? num(body, "ssRsrp") ?? num(body, "rssi") ?? num(body, "mDbm");
    return {
      radio,
      registered: /mRegistered\s*=\s*(YES|true)/i.test(body),
      mcc: num(body, "mMcc") ?? num(body, "mMccStr") ?? null,
      mnc: num(body, "mMnc") ?? num(body, "mMncStr") ?? null,
      ci: num(body, "mNci") ?? num(body, "mCi") ?? num(body, "mCid") ?? null,
      tac: num(body, "mTac") ?? num(body, "mLac") ?? null,
      pci: num(body, "mPci") ?? num(body, "mPsc") ?? null,
      earfcn:
        num(body, "mEarfcn") ??
        num(body, "mNrarfcn") ??
        num(body, "mUarfcn") ??
        num(body, "mArfcn"),
      dbm,
      quality: num(body, "rsrq") ?? num(body, "ssRsrq"),
      level: num(body, "mLevel") ?? num(body, "level"),
      operator,
    } satisfies CellRecord;
  });
  // Registered/serving cell first, then by strongest signal.
  return cells.sort(
    (a, b) => Number(b.registered) - Number(a.registered) || (b.dbm ?? -999) - (a.dbm ?? -999),
  );
}

/** Radio-agnostic label for a cell, short enough for a watch row. */
export function cellLabel(c: CellRecord): string {
  const net = c.mcc !== null && c.mnc !== null ? `${c.mcc}-${c.mnc}` : "??";
  return `${net} · ${c.ci ?? "?"}`;
}

/** 0-4 bars, derived from dBm when Android doesn't hand us a level. */
export function cellBars(c: CellRecord): number {
  if (c.level !== null && c.level >= 0 && c.level <= 4) return c.level;
  const d = c.dbm;
  if (d === null) return 0;
  if (d >= -85) return 4;
  if (d >= -95) return 3;
  if (d >= -105) return 2;
  if (d >= -115) return 1;
  return 0;
}

/* ---- BeaconDB geolocate payload -------------------------------------- */

export type GeolocatePayload = {
  cellTowers: {
    radioType: string;
    mobileCountryCode: number;
    mobileNetworkCode: number;
    locationAreaCode: number;
    cellId: number;
    signalStrength?: number;
  }[];
  wifiAccessPoints: { macAddress: string; signalStrength?: number; frequency?: number }[];
};

export type GeolocateResult = {
  lat: number;
  lon: number;
  accuracy: number;
  source: string;
};

/** Only cells with a complete MCC/MNC/LAC/CID tuple are usable for lookup. */
export function toGeolocateCells(cells: CellRecord[]): GeolocatePayload["cellTowers"] {
  return cells
    .filter((c) => c.mcc !== null && c.mnc !== null && c.tac !== null && c.ci !== null)
    .slice(0, 12)
    .map((c) => ({
      radioType:
        c.radio === "nr" ? "nr" : c.radio === "wcdma" ? "wcdma" : c.radio === "gsm" ? "gsm" : "lte",
      mobileCountryCode: c.mcc!,
      mobileNetworkCode: c.mnc!,
      locationAreaCode: c.tac!,
      cellId: c.ci!,
      ...(c.dbm !== null ? { signalStrength: c.dbm } : {}),
    }));
}
