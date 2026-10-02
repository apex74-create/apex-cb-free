/**
 * Research studies the free builds currently contribute aggregate data to.
 * Placeholder entries until the owner supplies the real study names and terms.
 * The engine's own regional-pattern study is always listed first.
 */
export type Study = { id: string; name: string; duration: string; collects: string; placeholder?: boolean };

export const CURRENT_STUDIES: Study[] = [
  {
    id: "regional-patterns",
    name: "369 engine: regional weather pattern prediction",
    duration: "Ongoing",
    collects: "Coarse-grid pressure, temperature and ground-check verdicts",
  },
  {
    id: "ag-microclimate",
    name: "Agricultural microclimate and frost study",
    duration: "6 months (placeholder)",
    collects: "Coarse-grid frost, dew and mold-risk observations",
    placeholder: true,
  },
];
