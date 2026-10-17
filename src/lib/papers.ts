/**
 * Community shell stub — the paper library (patent drafts, engine white
 * papers, provenance records) ships only with the licensed/private build.
 * The library pages render empty here.
 */
export type PaperKind =
  | "Patent draft"
  | "White paper"
  | "Strategy note"
  | "Provenance record"
  | "Operating record"
  | (string & {});

export type Paper = {
  slug: string;
  title: string;
  kind: PaperKind;
  [key: string]: unknown;
};

export const PAPER_KIND_ORDER: PaperKind[] = [];

export const PAPERS: Paper[] = [];

export function papersForProduct(_slug: string): Paper[] {
  return [];
}

export function paperBySlug(_slug: string): Paper | undefined {
  return undefined;
}
