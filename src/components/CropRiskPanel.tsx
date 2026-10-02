import type { MoldIndexResult } from "@/lib/engines/mold-index";

/**
 * Crop pathogen pressure for the next few days: Botrytis germination risk,
 * how dry the air actually is (VPD), and how long the canopy stays wet.
 * Temperatures are shown in all three modalities — F, C and K.
 */

const TONE: Record<string, string> = {
  CRITICAL_PATHOGEN_PRESSURE: "text-signal border-signal/60",
  ELEVATED_SPORE_RISK: "text-scan border-scan/60",
  OPTIMAL_CANOPY_CONDITIONS: "text-muted-foreground border-border",
};

const HEADLINE: Record<string, string> = {
  CRITICAL_PATHOGEN_PRESSURE: "Critical — mold will germinate",
  ELEVATED_SPORE_RISK: "Elevated — watch dense flower clusters",
  OPTIMAL_CANOPY_CONDITIONS: "Clear — air is drying the canopy",
};

export function CropRiskPanel({ mold }: { mold: MoldIndexResult }) {
  const tone = TONE[mold.status_code] ?? "text-muted-foreground border-border";
  const peakIdx = mold.botrytis_risk_timeline.indexOf(mold.max_botrytis_spore_risk_pct);
  const f = mold.temperature_f_timeline[peakIdx];
  const c = mold.temperature_c_timeline[peakIdx];
  const k = mold.temperature_k_timeline[peakIdx];
  const max = Math.max(1, ...mold.botrytis_risk_timeline);

  return (
    <section className={`mt-2 rounded-sm border bg-card/60 p-2 ${tone}`}>
      <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
        crop mold index · botrytis
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest">
        {HEADLINE[mold.status_code] ?? mold.status_code} ·{" "}
        {mold.max_botrytis_spore_risk_pct.toFixed(1)}%
      </p>

      <div className="mt-2 flex h-10 items-end gap-[1px]">
        {mold.botrytis_risk_timeline.map((risk, i) => (
          <span
            key={`${mold.hours[i] ?? i}`}
            className="flex-1 rounded-t-[1px] bg-current"
            style={{ height: `${Math.max(4, (risk / max) * 100)}%`, opacity: 0.25 + risk / 160 }}
          />
        ))}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-1 text-[8px] uppercase tracking-widest text-muted-foreground">
        <div>
          <dt>air dryness (vpd)</dt>
          <dd className="text-foreground">{mold.average_vpd_kpa.toFixed(2)} kPa avg</dd>
        </div>
        <div>
          <dt>wet hours at peak</dt>
          <dd className="text-foreground">{mold.peak_wet_hours.toFixed(1)} h</dd>
        </div>
        <div>
          <dt>peak hour</dt>
          <dd className="text-foreground">
            {mold.peak_hour ? mold.peak_hour.replace("T", " ").slice(0, 16) : "--"}
          </dd>
        </div>
        <div>
          <dt>temp at peak</dt>
          <dd className="text-foreground">
            {typeof f === "number" ? `${f.toFixed(1)}°F · ${c?.toFixed(1)}°C · ${k?.toFixed(1)}K` : "--"}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-[7.5px] uppercase leading-relaxed tracking-widest text-muted-foreground">
        {mold.action_recommendation}
      </p>
    </section>
  );
}
