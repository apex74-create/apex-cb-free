import { useFaceShape } from "@/lib/face-shape";

/** Small chip that flips the layout between square and round watch faces. */
export default function FaceToggle() {
  const { shape, toggle } = useFaceShape();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Face shape: ${shape}. Tap to switch.`}
      className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:text-signal"
    >
      {shape === "round" ? "◯ round" : "▢ square"}
    </button>
  );
}
