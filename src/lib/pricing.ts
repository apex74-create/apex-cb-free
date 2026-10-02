/**
 * Pricing schema — rebuilt from the approved pricing lockdown plan
 * (.lovable/plan/pricing-lockdown-ready-to-build-2026-10-02.md).
 *
 * Four surfaces:
 *   1. CB LADDER      — base tiers, priced by handset count. Scanner tier is
 *                       a real differentiator between ladders.
 *   2. ADD-ONS        — per-handset upgrades (weather, maps, shield, routing,
 *                       GPS-less squad). Price = base + add-ons × handsets.
 *   3. NAMED EDITIONS — ready-made skins (Nightstand, Rancher, Gorilla Grow).
 *   4. OPERATOR TIER  — White Kit / Black Kit, contract-only, no buy button.
 *
 * Prices here are display copy. Authoritative amount is the provider price
 * object referenced by `priceId`; nothing in the app charges from this file.
 * Nothing on these pages advertises per-token mint cost — that's a locked
 * decision from the plan (securities framing).
 */

export type BillingPeriod = "month" | "year" | "once";

export type CbTier = {
  id: string;
  priceId: string | null;
  licenceSlug: string;
  name: string;
  tagline: string;
  amountUsd: number | null;
  period: BillingPeriod;
  /** e.g. "+ $0.50 / handset / mo" — rendered beneath the amount. */
  perHandset?: string;
  /** Max handsets covered by this tier's base allowance. */
  handsets: number;
  /** Channels available on each handset. */
  channels: number;
  /** Short label for the scanner column: "40-ch linear", "270-ch recursive stack", etc. */
  scanner: string;
  /** Highlights shown in the card body. */
  includes: string[];
  /** Marks the recommended tier in the ladder. */
  featured?: boolean;
  /** Contract-only tiers skip checkout. */
  contact?: boolean;
};

export const CB_LADDER: CbTier[] = [
  {
    id: "cb_free_research",
    licenceSlug: "cb-free-research",
    priceId: null,
    name: "Free (Research)",
    tagline: "Free, paid for with aggregate sensor data.",
    amountUsd: 0,
    period: "once",
    handsets: 3,
    channels: 40,
    scanner: "40-ch linear",
    includes: [
      "Two-phone walkie-talkie over hotspot or Wi-Fi",
      "Public channels, open to anyone on the network",
      "Limited weather brief",
      "Your reports feed the sensor array (that's the deal)",
    ],
    contact: true,
  },
  {
    id: "cb_keep_it_pair",
    licenceSlug: "cb-keep-it-pair",
    priceId: "cb_keep_it_pair_onetime",
    name: "Keep-it Pair",
    tagline: "Yours outright. No data sharing required.",
    amountUsd: 9.99,
    period: "once",
    handsets: 2,
    channels: 40,
    scanner: "40-ch linear",
    includes: [
      "Two licensed handsets plus yours",
      "Full channels 1–40",
      "Keep sharing off if you want",
      "Lifetime licence tied to your account",
    ],
  },
  {
    id: "cb_family_squad",
    licenceSlug: "cb-family-squad",
    priceId: "cb_family_squad_onetime",
    name: "Family / Squad",
    tagline: "A six-handset set with private rooms.",
    amountUsd: 19.99,
    period: "once",
    handsets: 6,
    channels: 40,
    scanner: "80-ch block scanner",
    includes: [
      "Up to 6 licensed handsets",
      "Private encrypted rooms",
      "Lost-token re-issue on request",
      "Nightstand / baby-intercom skin available",
    ],
  },
  {
    id: "cb_crew",
    licenceSlug: "cb-crew",
    priceId: "cb_crew_onetime",
    name: "Crew Set",
    tagline: "Ten handsets with foreman-grade scanning.",
    amountUsd: 29.99,
    period: "once",
    perHandset: "+ $0.50 / handset / mo",
    handsets: 10,
    channels: 80,
    scanner: "160-ch block scanner",
    includes: [
      "Up to 10 licensed handsets",
      "Private sub-channels for foremen",
      "80 channels per handset",
      "Scanner catches key-ups across the whole crew",
    ],
    featured: true,
  },
  {
    id: "cb_job_site",
    licenceSlug: "cb-job-site",
    priceId: "cb_job_site_monthly",
    name: "Job Site",
    tagline: "One QR to the whole site. Tokens return when a phone leaves.",
    amountUsd: 9.99,
    period: "month",
    perHandset: "+ $0.50 / handset",
    handsets: 30,
    channels: 80,
    scanner: "270-ch recursive stack",
    includes: [
      "Up to 30 handsets per site",
      "Share one QR, everyone's on the same channel",
      "Recursive stack scanner reports hits up the chain instantly",
      "Cancelled seats return tokens to the pool",
    ],
  },
  {
    id: "cb_site_pro",
    licenceSlug: "cb-site-pro",
    priceId: "cb_site_pro_monthly",
    name: "Site Pro",
    tagline: "Multiple sites, 100 handsets, split scanning across operators.",
    amountUsd: 24.99,
    period: "month",
    perHandset: "+ $0.50 / handset",
    handsets: 100,
    channels: 80,
    scanner: "270-ch recursive stack + multi-operator split",
    includes: [
      "Up to 100 handsets across multiple sites",
      "Admin roster and site assignment",
      "Scanner workload splits across operators above 270 channels",
      "Priority on moderator-earned drop share",
    ],
  },
];

/* ---------------------------------------------------------------- add-ons */

export type AddOn = {
  id: string;
  licenceSlug: string;
  priceId: string | null;
  name: string;
  summary: string;
  amountUsd: number;
  amountMaxUsd?: number;
  period: BillingPeriod;
  /** Rendered on the card: "per handset", "included in Op Kit", etc. */
  unit: string;
};

export const ADD_ONS: AddOn[] = [
  {
    id: "addon_weather_basic",
    licenceSlug: "addon-weather-basic",
    priceId: "addon_weather_basic_onetime",
    name: "Weather (basic)",
    summary: "Full forecast on that handset.",
    amountUsd: 2,
    period: "once",
    unit: "per handset",
  },
  {
    id: "addon_weather_meteorologist",
    licenceSlug: "addon-weather-meteorologist",
    priceId: "addon_weather_meteorologist_onetime",
    name: "Meteorologist Kit",
    summary: "Full kit, plus a media-ready report you can read on-air.",
    amountUsd: 5,
    amountMaxUsd: 10,
    period: "once",
    unit: "per handset",
  },
  {
    id: "addon_maps_tremor",
    licenceSlug: "addon-maps-tremor",
    priceId: "addon_maps_tremor_onetime",
    name: "Maps + Tremor view",
    summary: "Network and sensor visualization on the map.",
    amountUsd: 3,
    period: "once",
    unit: "per handset",
  },
  {
    id: "addon_signal_shield",
    licenceSlug: "addon-signal-shield",
    priceId: "addon_signal_shield_onetime",
    name: "Signal Shield",
    summary: "Trusted-tower check and spoof warning on that handset.",
    amountUsd: 5,
    period: "once",
    unit: "per handset",
  },
  {
    id: "addon_routing_shield",
    licenceSlug: "addon-routing-shield",
    priceId: "addon_routing_shield_onetime",
    name: "Routing Shield (3-domain)",
    summary:
      "Anonymous in / out through the shield as the AP anchor over Starlink or hotspot.",
    amountUsd: 10,
    period: "once",
    unit: "per handset — included in Op Kit",
  },
  {
    id: "addon_squad_gpsless",
    licenceSlug: "addon-squad-gpsless",
    priceId: "addon_squad_gpsless_onetime",
    name: "Squad positioning (no GPS)",
    summary: "Crew positions from known radio reference points + trilateration.",
    amountUsd: 5,
    period: "once",
    unit: "per handset",
  },
];

/* --------------------------------------------------------- named editions */

export type NamedEdition = {
  id: string;
  licenceSlug: string;
  priceId: string | null;
  name: string;
  tagline: string;
  handsets: string;
  includes: string[];
  priceLabel: string;
  contact?: boolean;
};

export const NAMED_EDITIONS: NamedEdition[] = [
  {
    id: "edition_nightstand",
    licenceSlug: "edition-nightstand",
    priceId: "edition_nightstand_onetime",
    name: "Nightstand / Baby Intercom",
    tagline: "An old phone on the nightstand becomes a touch-anywhere intercom.",
    handsets: "3 handsets",
    includes: [
      "Face-down standby, lift to hear",
      "Shake to close, touch anywhere for an emergency shout",
      "Dimmed always-on screen",
      "Free with research licence, or $9.99 to opt out",
    ],
    priceLabel: "Free or $9.99 once",
  },
  {
    id: "edition_rancher",
    licenceSlug: "edition-rancher",
    priceId: null,
    name: "Rancher",
    tagline: "A small field server at the ranch; crew walkie-talkie sets ride on top.",
    handsets: "12–30 handsets",
    includes: [
      "Run your own server (Chromebook script, Windows Server, or a tunnel)",
      "Starlink feeds the site, we pass out walkie-talkie sets",
      "Local media rides along on the same channel",
      "Site licence available for a one-time price",
    ],
    priceLabel: "$49–$99 / mo SaaS, or site licence",
    contact: true,
  },
  {
    id: "edition_gorilla",
    licenceSlug: "edition-gorilla-grow",
    priceId: "edition_gorilla_grow_onetime",
    name: "Gorilla Radio / Gorilla Grow",
    tagline: "Full weather, Shield, Starlink backpack — the mountain-grower kit.",
    handsets: "12 handsets",
    includes: [
      "Full weather + human-input weather + dataset engine",
      "Starlink backpack extender setup",
      "Shield confirms your router signal is yours",
      "Buy once or stay on managed updates",
    ],
    priceLabel: "$199 once, or $29.99 / mo",
  },
];

/* ------------------------------------------------------- farm-ag "report" */

export const FARM_AG = {
  title: "Farm Ag Kit — report to keep it",
  summary:
    "Full weather kit plus base CB, free, as long as you file a human weather report on your chosen cycle. Miss the window and advanced tools pause until you file. No ads: the report is the payment.",
  cycleOptions: ["Every 3 days", "Every 6 days", "Every 9 days"],
  unlocks: [
    "File a dew observation and the dew/frost switches light up on your handset",
    "Report wind and a wind-path layer appears on the map, built from everyone's reports + APRS",
    "Optional HAM layer stacks on top",
    "Streaks and your own station's history show on the map (no cartoon pets)",
  ],
};

/* --------------------------------------------------------- operator tier */

export type OperatorKit = {
  id: string;
  licenceSlug: string;
  name: string;
  who: string;
  includes: string[];
  priceLabel: string;
};

export const OPERATOR_KITS: OperatorKit[] = [
  {
    id: "operator_white",
    licenceSlug: "operator-white-kit",
    name: "White Kit",
    who: "Authorized pen testers and defenders.",
    includes: [
      "Shield plus the full tool deck",
      "Licensed operator scripts with documentation",
      "Foundry API at operator volume",
      "VRP write-ups (Cloudflare onboarding SSL takeover, cell-farm amplification PoC), read-only under NDA",
    ],
    priceLabel: "$2,500–$3,500 / yr per operator",
  },
  {
    id: "operator_black",
    licenceSlug: "operator-black-kit",
    name: "Black Kit",
    who: "Senior / red-team firms under a signed technical agreement.",
    includes: [
      "Everything in White Kit",
      "10 hours per year of direct sessions with the author",
      "Field-script source under NDA",
      "Early access to new engines",
    ],
    priceLabel: "$10,000+ / yr, negotiated",
  },
];

export const OPERATOR_RULES = [
  "Signed licence + technical agreement before any kit ships",
  "Confirmed identity, with a written authorization statement per engagement",
  "Device-locked keys. Breaking terms revokes keys and halts the account",
  "Dual-use rule: manual review of every applicant, right to refuse without reason",
];

/* ---------------------------------------------------------------- helpers */

export function amountLabel(tier: {
  amountUsd: number | null;
  period: BillingPeriod;
  amountMaxUsd?: number;
}): string {
  if (tier.amountUsd === null) return "Contact";
  if (tier.amountUsd === 0) return "Free";
  const fmt = (n: number) =>
    n >= 100 ? `$${n.toLocaleString("en-US")}` : `$${n.toFixed(2)}`;
  const base = tier.amountMaxUsd
    ? `${fmt(tier.amountUsd)}–${fmt(tier.amountMaxUsd)}`
    : fmt(tier.amountUsd);
  if (tier.period === "once") return `${base} once`;
  return `${base}/${tier.period === "month" ? "mo" : "yr"}`;
}

/* -------------------------------- Legacy shims kept so unrelated callers --
 * still compile. These re-export the old names used by pages that haven't
 * been migrated to the new ladder yet (store catalogue cards, etc.). They
 * MUST remain tiny — nothing in the new pricing surface reads from them.
 */
export type PricingTier = {
  id: string;
  priceId: string | null;
  licenceSlug: string;
  name: string;
  tagline: string;
  amountUsd: number | null;
  period: BillingPeriod;
  unit?: string;
  includes: string[];
  featured?: boolean;
  contact?: boolean;
};

export const SUBSCRIPTIONS: PricingTier[] = [];
export const PERPETUAL: PricingTier[] = [];
export const ENTERPRISE: PricingTier[] = [];

export type DataProduct = {
  id: string;
  priceId: string | null;
  licenceSlug: string;
  name: string;
  audience: string;
  amountUsd: number | null;
  period: BillingPeriod;
  included: string;
  overageUsdPerThousand: number | null;
  redistribution: "none" | "internal" | "commercial" | "broadcast";
  includes: string[];
  contact?: boolean;
};

export const DATA_PRODUCTS: DataProduct[] = [];
export const REDISTRIBUTION_LABEL: Record<DataProduct["redistribution"], string> = {
  none: "No redistribution",
  internal: "Internal redistribution",
  commercial: "Commercial redistribution",
  broadcast: "Broadcast redistribution",
};
