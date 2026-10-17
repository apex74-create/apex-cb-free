/**
 * Community shell stub — the mold-index engine ships only in the licensed
 * native build. This module keeps the shell's type surface intact.
 */
export type MoldStatusCode = string;

export type MoldIndexResult = {
  max_botrytis_spore_risk_pct: number;
  average_vpd_kpa: number;
  status_code: MoldStatusCode;
  action_recommendation: string;
  botrytis_risk_timeline: number[];
  vpd_kpa_timeline: number[];
  peak_wet_hours: number;
  peak_hour?: string | null;
  temperature_f_timeline: number[];
  temperature_c_timeline: number[];
  temperature_k_timeline: number[];
  relative_humidity_timeline: number[];
};
