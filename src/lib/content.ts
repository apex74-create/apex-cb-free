export type ContentPostStatus = "draft" | "ready" | "published";
export type ContentPostSourceKind = "field-note" | "briefing" | "recovery";
export type PublishTarget = "none" | "netlify";

export type WhoopSnapshot = {
  recovery: number | null;
  strain: number | null;
  sleepPerformance: number | null;
  capturedAt: string;
  note: string;
};

export type ContentPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: ContentPostStatus;
  tags: string[];
  sourceKind: ContentPostSourceKind;
  sourceRefs: string[];
  whoop: WhoopSnapshot;
  publishTarget: PublishTarget;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentDraftInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: ContentPostStatus;
  tags: string[];
  sourceKind: ContentPostSourceKind;
  sourceRefs: string[];
  whoop: WhoopSnapshot;
  publishTarget: PublishTarget;
};

export const CONTENT_SOURCE_SUMMARY: {
  label: string;
  sub: string;
  tone: "signal" | "scan" | "warn";
}[] = [
  { label: "Bridge", sub: "adb logs · watch output", tone: "scan" },
  { label: "Radar", sub: "rf solves · rogue notes", tone: "signal" },
  { label: "Mesh", sub: "reticulum field reports", tone: "warn" },
  { label: "PCAP", sub: "capture findings · replay notes", tone: "signal" },
  { label: "Whoop", sub: "recovery snapshot attached by operator", tone: "warn" },
  { label: "Netlify", sub: "publish target via secure build hook", tone: "scan" },
];

export function emptyWhoop(): WhoopSnapshot {
  return {
    recovery: null,
    strain: null,
    sleepPerformance: null,
    capturedAt: "",
    note: "",
  };
}

export function emptyContentDraft(): ContentDraftInput {
  return {
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    status: "draft",
    tags: [],
    sourceKind: "field-note",
    sourceRefs: ["bridge", "radar", "mesh", "pcap"],
    whoop: emptyWhoop(),
    publishTarget: "netlify",
  };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
