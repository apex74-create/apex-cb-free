/**
 * Research studies the free builds currently contribute aggregate data to.
 * Studies run in 90-day loops: each loop opens, collects, closes and is
 * replaced by the next loop. The engine's own regional-pattern study is
 * always listed first.
 */
export type Study = { id: string; name: string; duration: string; collects: string; placeholder?: boolean };

export const CURRENT_STUDIES: Study[] = [
  {
    id: "regional-patterns",
    name: "369 engine: regional weather pattern prediction",
    duration: "Ongoing — 90-day loops",
    collects: "Coarse-grid pressure, temperature and ground-check verdicts",
  },
  {
    id: "ag-microclimate",
    name: "Field Loop 1: frost, dew and mold-risk microclimate",
    duration: "90 days",
    collects: "Coarse-grid frost, dew and mold-risk observations",
  },
  {
    id: "wind-paths",
    name: "Field Loop 2: human wind reports vs. model wind",
    duration: "90 days",
    collects: "Anecdotal wind direction/strength reports, coarse-grid only",
  },
];
