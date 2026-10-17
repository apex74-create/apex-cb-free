import { createFileRoute } from "@tanstack/react-router";

/**
 * Community-shell forecast endpoint.
 *
 * The licensed build runs the proprietary synthesis engines server-side. This
 * public mirror ships a direct Open-Meteo pass-through instead: the caller's
 * handset already pulled the public feeds (`fetchHandsetFeeds` in
 * src/services/forecastApi.ts); we re-shape them into the timeline the UI
 * renders and label the response `public-fallback`.
 *
 * No engine output, no model calls, no secrets.
 */

type Daily = {
  time?: string[];
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  temperature_2m_mean?: Array<number | null>;
  shortwave_radiation_sum?: Array<number | null>;
};

type Hourly = {
  time?: string[];
  temperature_2m?: Array<number | null>;
};

type Point = {
  date: string;
  iso?: string;
  temp: number;
  baseline: number;
  elNino: number;
  observed?: boolean;
  analog?: number;
};

type Feeds = { daily?: Daily; hourly?: Hourly; past_days?: number };

export const Route = createFileRoute("/api/public/forecast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let feeds: Feeds;
        try {
          feeds = (await request.json()) as Feeds;
        } catch {
          return new Response(JSON.stringify({ error: "invalid body" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const daily = feeds.daily ?? {};
        const hourly = feeds.hourly ?? {};
        const past = Math.max(0, Math.min(Number(feeds.past_days ?? 14), 92));
        const times = daily.time ?? [];
        const highs = daily.temperature_2m_max ?? [];
        const lows = daily.temperature_2m_min ?? [];
        const means = daily.temperature_2m_mean ?? [];

        const meanOf = (xs: Array<number | null>) => {
          const ok = xs.filter((x): x is number => x != null);
          return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
        };

        const baselineMean = meanOf(means.slice(0, past));
        const baseline = baselineMean ?? 50;
        const solar = daily.shortwave_radiation_sum ?? [];

        const timeline: Point[] = [];
        for (let i = 0; i < times.length; i++) {
          const mean = means[i] ?? (highs[i] != null && lows[i] != null ? ((highs[i]! + lows[i]!) / 2) : null);
          if (mean == null) continue;
          const t = past > 0 && i < past ? 1 : 0;
          // solar-normalised oscillation around the baseline mean: the public
          // stand-in for the wave synthesis. No analog years, no metadata.
          const sun = solar[i] ?? 0;
          const solarMean = meanOf(solar.slice(0, past)) ?? sun;
          const wobble = solarMean > 0 ? (sun - solarMean) / Math.max(1, solarMean) : 0;
          timeline.push({
            date: times[i]!,
            iso: times[i]!,
            temp: mean + wobble * 2,
            baseline,
            elNino: 0,
            observed: i < past,
            analog: t ? mean : undefined,
          });
        }

        const hourlyTemps = hourly.temperature_2m ?? [];
        const dewFloor = hourlyTemps.length ? Math.min(...hourlyTemps.filter((x): x is number => x != null)) : null;

        const peakIdx = timeline.reduce(
          (best, p, i) => (p.temp > (timeline[best]?.temp ?? -Infinity) ? i : best),
          0,
        );

        const payload = {
          metadata: {
            latitude: 0,
            longitude: 0,
            peak_date: times[peakIdx] ?? new Date().toISOString().slice(0, 10),
            peak_intensity: timeline[peakIdx]?.temp ?? baseline,
            confidence_score: 0.3,
            enso_state: "neutral",
            anchored: false,
            observations_used: 0,
            model_tier: "V1" as const,
          },
          timeline,
          source: "public-fallback",
          notice:
            "Community shell: basic public-data forecast. The proprietary wave-collapse synthesis is not included in this mirror.",
          dew_floor_f: dewFloor,
        };

        return new Response(JSON.stringify(payload), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
