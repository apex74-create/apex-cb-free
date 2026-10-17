import { useAmbient } from "@/lib/use-ambient";
import { summarise } from "@/lib/ambient";

/**
 * Bridgeless ambient readout. No ADB, no agent — the browser itself reports
 * the surrounding network picture: interfaces, mDNS/Bonjour presence, NAT
 * shape, bearer class, hop timing across the three static index pages, the
 * position fix and the platform sensors.
 */
export default function AmbientPanel({ compact = false }: { compact?: boolean }) {
  const { sample, scanning, error, refresh } = useAmbient(20_000, true);

  const row = (label: string, value: string | null, tone = "text-signal") => (
    <div key={label} className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-baseline gap-2">
      <span className="text-[8px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span
        className={`truncate text-right text-[9px] tracking-wider ${value ? tone : "text-muted-foreground"}`}
      >
        {value ?? "—"}
      </span>
    </div>
  );

  const ice = sample?.ice;
  const carrier = sample?.carrier;
  const plat = sample?.platform;

  return (
    <section className="mb-2 rounded-sm border border-scan/60 bg-card/60 px-2 py-1.5">
      <button
        type="button"
        onClick={refresh}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left"
        aria-label="Rescan ambient signal"
      >
        <span className="min-w-0">
          <span className="block truncate text-[9px] font-bold uppercase tracking-widest text-scan">
            {scanning ? "○ " : "● "}AMBIENT SIGNAL · NO BRIDGE
          </span>
          <span className="block truncate text-[8px] uppercase tracking-wider text-muted-foreground">
            {error ?? (sample ? summarise(sample) : "sampling…")}
          </span>
        </span>
        <span className="shrink-0 text-[8px] uppercase tracking-widest text-muted-foreground">
          rescan
        </span>
      </button>

      {sample ? (
        <div className="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
          {row(
            "bearer",
            carrier?.type ??
              carrier?.effective?.toUpperCase() ??
              (carrier?.online ? "online" : "offline"),
          )}
          {row(
            "link",
            carrier?.downlinkMbps !== null && carrier?.downlinkMbps !== undefined
              ? `${carrier.downlinkMbps} Mb/s · ${carrier.rttMs ?? "?"}ms`
              : null,
          )}
          {row(
            "subnet",
            ice?.subnets.length ? ice.subnets.map((s) => `${s}.0/24`).join(" ") : null,
          )}
          {row(
            "bonjour",
            ice?.mdns ? "mDNS names present" : ice ? "none heard" : null,
            "text-warn",
          )}
          {row("nat", ice?.natType ?? null)}
          {row("wan", ice?.publicAddress ?? null)}
          {row("interfaces", ice?.hosts.length ? String(ice.hosts.length) : null)}
          {row(
            "hops",
            sample.hops.map((h) => `${h.name}:${h.ms === null ? "×" : `${h.ms}ms`}`).join(" "),
            sample.hops.some((h) => h.error) ? "text-warn" : "text-signal",
          )}
          {row("jitter", sample.jitterMs === null ? null : `±${sample.jitterMs} ms`)}
          {row(
            "fix",
            sample.fix
              ? `${sample.fix.lat.toFixed(4)}, ${sample.fix.lon.toFixed(4)} ±${Math.round(sample.fix.accuracyM ?? 0)}m`
              : null,
          )}

          {compact ? null : (
            <>
              {row(
                "platform",
                plat ? `${plat.cores ?? "?"} cores · ${plat.memoryGb ?? "?"}GB` : null,
              )}
              {row(
                "power",
                plat?.batteryPct === null || plat?.batteryPct === undefined
                  ? null
                  : `${plat.batteryPct}%${plat.charging ? " chg" : ""}`,
              )}
              {row(
                "sensors",
                plat
                  ? [plat.motion ? "motion" : null, plat.orientation ? "orientation" : null]
                      .filter(Boolean)
                      .join(" · ") || "none"
                  : null,
              )}
              {ice?.hosts.length ? (
                <ul className="mt-1 space-y-0.5 border-t border-border pt-1">
                  {ice.hosts.slice(0, 8).map((h) => (
                    <li
                      key={h.address}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2 text-[8px] tracking-wider"
                    >
                      <span className="uppercase text-muted-foreground">{h.kind}</span>
                      <span className="truncate text-right text-scan">{h.address}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {ice?.error ? (
                <p className="pt-1 text-[8px] uppercase tracking-wider text-warn">{ice.error}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
