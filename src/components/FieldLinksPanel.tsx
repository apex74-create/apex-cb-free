/**
 * Community shell placeholder — field links (mesh / USB radio carriers).
 *
 * The handset-to-handset daisy chain is licensed technology and is not
 * included in this community shell. See LICENSE; API access:
 * https://tinyradr.com
 */
export function FieldLinksPanel() {
  return (
    <section className="rounded-sm border border-border/60 bg-card/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Field links — licensed feature
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        The device-to-device daisy chain (mesh, USB radio, BLE bridge) ships with a licensed
        build. This community shell carries traffic over the cloud relay only.
      </p>
      <a
        href="https://tinyradr.com/store"
        className="mt-2 inline-block rounded-sm border border-signal/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-signal hover:bg-signal/10"
      >
        API access / licence
      </a>
    </section>
  );
}
