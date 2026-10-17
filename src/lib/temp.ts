/**
 * Every absolute temperature readout shows all three scales.
 * Deltas (anomaly, correction, DTR) stay single-unit — a difference is not a reading.
 */
export function fck(f: number, digits = 1): string {
  const c = (f - 32) * (5 / 9);
  const k = c + 273.15;
  return `${f.toFixed(digits)}°F · ${c.toFixed(digits)}°C · ${k.toFixed(digits)}K`;
}

/** Compact form for tight strips: "72°/22°/295°". */
export function fckShort(f: number): string {
  const c = (f - 32) * (5 / 9);
  return `${Math.round(f)}°/${Math.round(c)}°/${Math.round(c + 273.15)}°`;
}
