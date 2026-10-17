/**
 * Community shell stub — the full denied-mode solver ships only in the
 * licensed native build. This module keeps the shell's type surface intact.
 */
export type RelFix = {
  source: string;
  lat?: number;
  lon?: number;
  accuracy_m?: number;
  heading_deg?: number | null;
  speed_mps?: number | null;
  ts?: number;
  [key: string]: unknown;
};
