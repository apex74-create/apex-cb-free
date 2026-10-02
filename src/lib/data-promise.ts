/**
 * The short, plain-English data agreement. One source of truth so the store
 * listing, the landing page, the privacy page, the pricing page and first
 * launch all say exactly the same thing.
 */

export const DATA_PROMISE_TITLE = "Most weather apps are a location grab. This one is not.";

export const DATA_PROMISE_SUMMARY =
  "The weather business runs on selling where you are. We built the opposite: your fine readings stay on your device, and only coarse canonical numbers ever leave it.";

export const DATA_PROMISE_POINTS = [
  "Your exact position, device sensors and raw readings stay on your device.",
  "On the free builds your reading is rounded to a coarse grid and mixed with others before it leaves. Only that aggregate ever goes out.",
  "Reads are aggregate only. Nobody, including us, can pull your individual reports back out.",
  "No advertising identifiers, no data brokers, no selling or renting your location. Ever.",
  "Paid plans can keep contribution off. Free builds contribute aggregates as the price of free use.",
  "Delete your account and the aggregates keep no link to you, because they never held one.",
];

/**
 * Free builds (Sovereign CB, Field Grower) are applied-research releases.
 * This is the grant-facing half of the promise: what free use contributes and
 * what it never contributes. Store listings and grant proposals quote this.
 */
export const GRANT_DATA_TITLE = "Free builds are research editions.";

export const GRANT_DATA_POINTS = [
  "The free builds exist so more sensors exist. Using one means you agree to this section.",
  "Anonymized, aggregated sensor and signal observations — never names, message content, or precise tracks — may be used in agricultural and atmospheric research and in grant reporting.",
  "Observations are rounded to a coarse grid and mixed with others before they leave your device, the same as every other build.",
  "Contribution is part of free use and cannot be switched off in Settings. If you do not want to contribute, use a paid plan or delete your account.",
  "The studies your aggregates go to are listed below, with how long each runs.",
  "Research partners and grant reviewers can audit the aggregate pipeline; there is no second channel that carries more.",
];

export const DATA_PROMISE_SHORT_EULA = [
  "You own what you buy. A licence is tied to your account and keeps working.",
  "You own what your device measures. We only receive coarse aggregates, never raw readings.",
  "We sell forecast numbers, not people. Data products carry no account, device or precise position.",
  "Forecasts are forecasts. Use judgement in a life-safety situation; they carry no warranty.",
  "You can stop at any time: export, move to a paid plan, or delete the account outright.",
];
