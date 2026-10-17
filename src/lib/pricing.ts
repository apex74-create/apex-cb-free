/**
 * CB offer ladder. Paid base tiers carry live provider price ids; add-ons and
 * named editions remain display-only until their fulfilment is verified.
 *
 * Four surfaces:
 *   1. CB LADDER      — base tiers, priced by handset count. Scanner tier is
 *                       a real differentiator between ladders.
 *   2. ADD-ONS        — draft per-handset upgrades, not checkout offers.
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
  /** Proposed active-device monthly unit — rendered beneath the amount. */
  perHandset?: string;
  /** Max handsets covered by this tier's base allowance. */
  handsets: number;
  /** Channels available on each handset. */
  channels: number;
  /** Short scanner label, not a promise of unverified relay service. */
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
    tagline: "20 channels free — emergency 9 and common 19 included.",
    amountUsd: 0,
    period: "once",
    handsets: 2,
    channels: 20,
    scanner: "20-ch linear",
    includes: [
      "20 channels, including emergency 9 and common 19",
      "Public channels, open to anyone on the network",
      "Limited weather brief",
      "Aggregate research contribution disclosed before joining",
      "No daisy-chain relay — single-hop only",
    ],
    contact: true,
  },
  {
    id: "cb_keep_it_pair",
    licenceSlug: "cb-keep-it-pair",
    priceId: "keep_it_pair_onetime",
    name: "Keep-it Pair",
    tagline: "Two sets for $20 — 80 channels, no monthly charge.",
    amountUsd: 19.99,
    period: "once",
    handsets: 2,
    channels: 80,
    scanner: "80-ch linear",
    includes: [
      "Two handset sets",
      "80 channels",
      "No daisy-chain relay (starts at Family / Squad)",
      "No guaranteed lifetime hosted service",
      "Licence delivery pending verification",
    ],
  },
  {
    id: "cb_family_squad",
    licenceSlug: "cb-family-squad",
    priceId: "family_squad_onetime",
    name: "Family / Squad",
    tagline: "A six-handset set with private rooms.",
    amountUsd: 39.99,
    period: "once",
    handsets: 6,
    channels: 160,
    scanner: "160-ch advanced scanner",
    includes: [
      "Up to 6 licensed handsets",
      "160 channels with the advanced scanner",
      "Daisy-chain relay across every link — the paid difference",
      "Private digital rooms, pending device entitlement verification",
    ],
  },
  {
    id: "cb_crew",
    licenceSlug: "cb-crew",
    priceId: "crew_onetime",
    name: "Crew Set",
    tagline: "Crew controls for up to ten handsets.",
    amountUsd: 69.99,
    period: "once",
    handsets: 10,
    channels: 270,
    scanner: "270-ch super scanner",
    includes: [
      "Up to 10 licensed handsets",
      "Full 270 channels with the super scanner",
      "Crew controls pending verification",
    ],
  },
  {
    id: "cb_job_site",
    licenceSlug: "cb-job-site",
    priceId: "job_site_monthly",
    name: "Job Site",
    tagline: "Single-site roster; managed billing not yet available.",
    amountUsd: 29,
    period: "month",
    perHandset: "+ $2 / active handset / month (max 30)",
    handsets: 30,
    channels: 270,
    scanner: "270-ch super scanner",
    includes: [
      "Up to 30 handsets per site",
      "Site roster pending verification",
      "270-channel scan pending verification",
      "30 active handsets: $89/month proposed",
    ],
  },
  {
    id: "cb_site_pro",
    licenceSlug: "cb-site-pro",
    priceId: "site_pro_monthly",
    name: "Site Pro",
    tagline: "Multiple sites and operator controls, contract proposal.",
    amountUsd: 99,
    period: "month",
    perHandset: "+ $2 / active handset / month (max 100)",
    handsets: 100,
    channels: 270,
    scanner: "270-ch super scanner",
    includes: [
      "Up to 100 handsets across multiple sites",
      "Multi-site controls pending verification",
      "100 active handsets: $299/month proposed",
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
    priceId: null,
    name: "Weather (basic)",
    summary: "Expanded weather for one handset; planned, not yet for sale.",
    amountUsd: 2,
    period: "once",
    unit: "per handset",
  },
  {
    id: "addon_weather_meteorologist",
    licenceSlug: "addon-weather-meteorologist",
    priceId: null,
    name: "Meteorologist Kit",
    summary: "Media-ready weather report; planned, not yet for sale.",
    amountUsd: 5,
    amountMaxUsd: 10,
    period: "once",
    unit: "per handset",
  },
  {
    id: "addon_maps_tremor",
    licenceSlug: "addon-maps-tremor",
    priceId: null,
    name: "Maps + Tremor view",
    summary: "Network and sensor map view; planned, not yet for sale.",
    amountUsd: 3,
    period: "once",
    unit: "per handset",
  },
  {
    id: "addon_signal_shield",
    licenceSlug: "addon-signal-shield",
    priceId: null,
    name: "Signal Shield",
    summary: "Native trusted-tower checks planned; not an audited VPN or for sale yet.",
    amountUsd: 5,
    period: "once",
    unit: "per handset",
  },
  {
    id: "addon_routing_shield",
    licenceSlug: "addon-routing-shield",
    priceId: null,
    name: "Routing Shield (3-domain)",
    summary: "Protected routing proposal; not an audited VPN or for sale yet.",
    amountUsd: 10,
    period: "once",
    unit: "per handset — included in Op Kit",
  },
  {
    id: "addon_squad_gpsless",
    licenceSlug: "addon-squad-gpsless",
    priceId: null,
    name: "Squad positioning (no GPS)",
    summary: "Estimated positions from reference points, not measured fixes; planned.",
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
    priceId: null,
    name: "Nightstand / Baby Intercom",
    tagline: "An old phone on the nightstand becomes a touch-anywhere intercom.",
    handsets: "3 handsets",
    includes: [
      "Face-down standby, lift to hear",
      "Shake to close, touch anywhere for an emergency shout",
      "Dimmed always-on screen",
      "Free research version; $9.99 skin/edition proposed, not a data opt-out",
    ],
    priceLabel: "Free or $9.99 once",
  },
  {
    id: "edition_rancher",
    licenceSlug: "edition-rancher",
    priceId: null,
    name: "Rancher",
    tagline: "A proposed field-server and CB setup for the ranch.",
    handsets: "12–30 handsets",
    includes: [
      "Field-server delivery and support terms require scoping",
      "CB sets over supported digital links",
      "Site licence subject to agreement",
    ],
    priceLabel: "$49–$99 / mo SaaS, or site licence",
    contact: true,
  },
  {
    id: "edition_gorilla",
    licenceSlug: "edition-gorilla-grow",
    priceId: null,
    name: "Gorilla Radio / Gorilla Grow",
    tagline: "Full weather, Shield, Starlink backpack — the mountain-grower kit.",
    handsets: "12 handsets",
    includes: [
      "Weather and human observation workflow proposed",
      "Field connectivity and Shield require native testing",
      "Delivery and support terms require scoping",
    ],
    priceLabel: "$199 once, or $29.99 / mo",
  },
];

/* ------------------------------------------------------- farm-ag "report" */

export const FARM_AG = {
  title: "Farm Ag Kit — reporting proposal",
  summary:
    "Free CB and weather reporting proposal. Human ground checks are evidence for review, not direct forecast-engine inputs. Report-based renewals are not active yet.",
  cycleOptions: ["Every 3 days", "Every 6 days", "Every 9 days"],
  unlocks: [
    "Record dew, frost and wind observations for review",
    "Compare ground checks with the forecast separately",
    "Renewal and advanced map layers await verification",
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
    Number.isInteger(n) ? `$${n.toLocaleString("en-US")}` : `$${n.toFixed(2)}`;
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

/* ------------------------------------------------------------------ */
/* Use-based ladders (approved 2026-10-05)                            */
/* ------------------------------------------------------------------ */

export type UseRung = {
  id: string;
  name: string;
  who: string;
  priceLabel: string;
  priceId: string | null;
  licenceSlug: string;
  includes: string[];
  contact?: boolean;
};

/** Cast Net Mesh priced by who uses it. Attendee viewing is always free. */
export const MESH_USE_LADDER: UseRung[] = [
  {
    id: "mesh_personal", name: "Personal", priceId: "mesh_personal_onetime", licenceSlug: "cast-net-mesh-personal",
    who: "Hoedown in the back yard, airsoft property, family camp-out — not for profit.",
    priceLabel: "$9.99 once",
    includes: ["Map your own property: house, well, driveways, camp spots, range", "Unlimited QR sharing for unlimited events", "Up to 150 people per event", "Every guest who scans gets the viewer plus their own 7-day builder trial"],
  },
  {
    id: "mesh_personal_cb_wx", name: "Personal + CB + Weather", priceId: "mesh_personal_cb_wx_onetime", licenceSlug: "cast-net-mesh-personal-cb-weather",
    who: "Same private use, with radio and weather inside Mesh.",
    priceLabel: "$24.99 once",
    includes: ["Everything in Personal", "Companion 80-channel CB with daisy chain", "Weather Standard inside Mesh"],
  },
  {
    id: "mesh_venue", name: "Venue", priceId: "mesh_venue_monthly", licenceSlug: "cast-net-mesh-venue",
    who: "Small business: hotel event hall, campground, parking-lot vendors.",
    priceLabel: "$49/mo or $399/yr",
    includes: ["Unlimited floors for one property", "Vendor desk and pickup", "500 viewers per event", "Companion CB and weather included", "Apex look — no custom branding"],
  },
  {
    id: "mesh_venue_pro", name: "Venue Pro", priceId: "mesh_venue_pro_monthly", licenceSlug: "cast-net-mesh-venue-pro",
    who: "Multi-property operators and festival grounds.",
    priceLabel: "$149/mo or $1,299/yr",
    includes: ["Up to 5 properties", "2,500 viewers per event", "Your logo and colours on event pages", "Priority support"],
  },
  {
    id: "mesh_enterprise", name: "Enterprise / Licensed assembly", priceId: null, licenceSlug: "cast-net-mesh-enterprise", contact: true,
    who: "Ticketing-scale platforms whose engineers rebuild the look.",
    priceLabel: "Contract · from $25k/yr + per-event fee",
    includes: ["Licensed Mesh assembly, full white-label", "Your own domain", "NDA; engine stays ours — API access, no source"],
  },
];

export const MESH_USE_RULES = [
  "Viewing an event by QR and the floor viewer stay free forever.",
  "Daisy chain is never free — it starts at Personal + CB + Weather.",
  "Personal is non-commercial. Ticketed or commercial events need Venue or higher.",
  "Earlier Builder purchases carry over as Personal; buyers keep what they paid for.",
];

/** Apex Watch Kit — one bundle, one price. Approved 2026-10-05 ($39–$69 range, set at $49). */
export const WATCH_KIT: UseRung = {
  id: "watch_kit",
  name: "Apex Watch Kit",
  priceId: "watch_kit_onetime",
  licenceSlug: "apex-watch-kit",
  who: "LokMat-class Android watches — the only software built to land on them.",
  priceLabel: "$49 once",
  includes: [
    "Signal watch face — weather, chance of precipitation, time, bearing",
    "Wrist CB radio — press-and-hold talk, channels 1–40, lands on 19",
    "Shield radar view on the wrist",
    "Sextant link",
    "No subscription, no split packages — one price, everything on the watch",
  ],
};

/** Free 7-day Watch Kit trial — an exploding coin drop, no card required. */
export const WATCH_KIT_TRIAL: UseRung = {
  id: "watch_kit_trial",
  name: "Watch Kit Trial",
  priceId: null,
  licenceSlug: "apex-watch-kit-trial",
  who: "Try the full watch bundle before you buy.",
  priceLabel: "Free · 7 days",
  includes: [
    "Everything in the Apex Watch Kit for 7 days",
    "Exploding coin drop — the trial coin lapses on its own, no card, no cancel step",
    "Upgrade to the $49 kit any time and keep going",
  ],
};

/** Greenhouse commercial — scales by site and device like Cast Net. */
export const GREENHOUSE_COMMERCIAL: UseRung[] = [
  {
    id: "greenhouse_commercial", name: "Greenhouse Commercial", priceId: "greenhouse_commercial_monthly", licenceSlug: "greenhouse-commercial",
    who: "One growing site with handsets and wall-mounted tablets.",
    priceLabel: "$79/mo + $3 per device",
    includes: ["1 site, up to 25 devices", "1 sensor array", "80-channel CB"],
  },
  {
    id: "greenhouse_commercial_pro", name: "Greenhouse Commercial Pro", priceId: "greenhouse_commercial_pro_monthly", licenceSlug: "greenhouse-commercial-pro",
    who: "Multi-house operations running several arrays.",
    priceLabel: "$199/mo + $3 per device",
    includes: ["Up to 5 sites, 100 devices", "Multiple sensor arrays", "270-channel CB", "Shield dash"],
  },
  {
    id: "grower_enterprise", name: "Grower Enterprise", priceId: null, licenceSlug: "grower-enterprise", contact: true,
    who: "Large growers and co-ops.",
    priceLabel: "Contract",
    includes: ["Unlimited sites", "API feed", "White-label", "Study-exempt"],
  },
];
