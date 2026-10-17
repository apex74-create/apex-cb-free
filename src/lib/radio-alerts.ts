/** Weather Radio alerts heard by a receiver on the cable (works with no internet). */
export type RadioAlert = { id: string; event: string; area: string; at: number };
const list: RadioAlert[] = [];
const subs = new Set<() => void>();

export function pushRadioAlert(event: string, area: string) {
  const id = `${event}|${area}`;
  const i = list.findIndex((a) => a.id === id);
  if (i >= 0) list.splice(i, 1);
  list.unshift({ id, event, area, at: Date.now() });
  list.length = Math.min(list.length, 5);
  subs.forEach((f) => f());
}
export function radioAlerts(): RadioAlert[] {
  const cut = Date.now() - 3 * 3600_000;
  return list.filter((a) => a.at > cut);
}
export function onRadioAlerts(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}
