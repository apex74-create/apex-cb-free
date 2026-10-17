/**
 * Community shell stub — the trust-scoring engine ships only in the licensed
 * native build. This module keeps the shell's type surface intact.
 */
export type SkySighting = {
  /** compass heading of the sighted body, degrees */
  bearing: number;
  /** elevation above horizon, degrees (0 when unknown) */
  altitude: number;
  ts: number;
};

export type TrustTerm = {
  key: string;
  label: string;
  points: number;
  max: number;
  note: string;
};
