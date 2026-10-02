import { useState } from "react";
import { fck, fckShort } from "@/lib/temp";
import {
  surfaceLow,
  firstFrostNight,
  toC,
  toK,
  type Exposure,
  type NightProjection,
} from "@/lib/engines/diurnal";

/**
 * High / low range and the frost watch. The air low is the shelter-height
 * number every forecast quotes; the surface number is what the plants actually
 * sit in on a clear, calm night — the one that decides whether frost touches
 * down. Site exposure is the user's own ground truth, so it is a control.
 */

const EXPOSURE_LABEL: Record<Exposure, string> = {
  ridge: "ridge / crest",
  open: "open flat",
  hollow: "hollow / low spot",
};

const CLASS_TONE: Record<string, string> = {
  freeze: "text-signal",
  frost: "text-signal",
  touchdown: "text-scan",
  clear: "text-muted-foreground",
};

const CLASS_LABEL: Record<string, string> = {
  freeze: "hard freeze",
  frost: "frost",
  touchdown: "touchdown range",
  clear: "clear",
};

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

export function FrostWatchPanel({
  data,
}: {
  data: {
    dtr_72h: number | null;
    dtr_trailing: number | null;
    dtr_days: number;
    nights: NightProjection[];
  };
}) {
  const [exposure, setExposure] = useState<Exposure>("ridge");
  const [canopyGap, setCanopyGap] = useState(true);
  const nights = data.nights.slice(0, 10);
  const first = firstFrostNight(nights, exposure, canopyGap);
  const firstTouch = nights.find(
    (n) => surfaceLow(n, exposure, canopyGap).class === "touchdown",
  );

  return (
    <section className="mt-2 rounded-sm border border-border bg-card/60 p-2">
      <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
        high / low range · frost watch
      </p>

      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-foreground">
        {first
          ? `${CLASS_LABEL[first.read.class]} ${dayLabel(first.night.iso)} pre-dawn · ${fck(first.read.surface_f, 0)} at ground`
          : firstTouch
            ? `touchdown range ${dayLabel(firstTouch.iso)} pre-dawn · ${fck(surfaceLow(firstTouch, exposure, canopyGap).surface_f, 0)} at ground`
            : "no frost in the projected run"}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {(Object.keys(EXPOSURE_LABEL) as Exposure[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setExposure(key)}
            className={`rounded-full border px-2 py-[2px] text-[8px] uppercase tracking-widest ${
              exposure === key
                ? "border-scan/60 bg-scan/15 text-foreground"
                : "border-border/60 bg-background/40 text-muted-foreground"
            }`}
          >
            {EXPOSURE_LABEL[key]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCanopyGap((v) => !v)}
          className={`rounded-full border px-2 py-[2px] text-[8px] uppercase tracking-widest ${
            canopyGap
              ? "border-scan/60 bg-scan/15 text-foreground"
              : "border-border/60 bg-background/40 text-muted-foreground"
          }`}
        >
          canopy gap {canopyGap ? "on" : "off"}
        </button>
      </div>

      <ul className="mt-2 space-y-[2px]">
        {nights.map((night) => {
          const read = surfaceLow(night, exposure, canopyGap);
          return (
            <li
              key={night.iso}
              className="grid grid-cols-[2.4rem_1fr_auto] items-center gap-1 rounded-sm bg-background/40 px-1 py-[3px] text-[9px]"
            >
              <span className="uppercase tracking-widest text-muted-foreground">
                {dayLabel(night.iso)}
              </span>
              <span className="text-foreground">
                {fckShort(night.high_f)} / {fck(read.air_f, 0)}
                <span className="text-muted-foreground">
                  {" "}
                  · {toC(read.air_f).toFixed(1)}°C · {toK(read.air_f).toFixed(1)}K
                  {night.dew_floored ? " · dew floor" : ""}
                </span>
              </span>
              <span className={`uppercase tracking-widest ${CLASS_TONE[read.class]}`}>
                {read.surface_f.toFixed(0)}° gnd · {read.risk_pct}%
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[8px] leading-relaxed text-muted-foreground">
        Lows are projected from this site's own diurnal range — the last 72 hours
        weighed against the trailing season
        {data.dtr_72h !== null && data.dtr_trailing !== null
          ? ` (${data.dtr_72h.toFixed(1)}°F vs ${data.dtr_trailing.toFixed(1)}°F over ${data.dtr_days} days)`
          : ""}
        , widened where the sky is clear and floored at the dew point. The ground
        number subtracts radiative loss at plant height: that is the one that
        frosts at 38°F on the thermometer.
      </p>
    </section>
  );
}
