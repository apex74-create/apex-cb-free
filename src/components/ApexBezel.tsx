import { useEffect } from "react";

/**
 * The CB deck's chassis treatment, lifted into a frame any app can wear:
 * heavy amber bezel, diagonal rainbow screen flash, rim chase around all
 * four edges, and rounded corners on every control (via `apex-skin` on
 * <html>). Pure presentation — it never touches the page's layout or
 * pointer events.
 */
export default function ApexBezel({ skin }: { skin?: "watch" | "weather" | "mesh" | "uap" | "ghost" | "mystic" | "shield" | undefined }) {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("apex-skin");
    return () => el.classList.remove("apex-skin");
  }, []);
  return (
    <div className={`apex-bezel cb-bezel ${skin ? `skin-${skin}` : ""}`} aria-hidden="true">
      <span className="cb-rim-chase cb-rim-left" />
      <span className="cb-rim-chase cb-rim-right" />
      <span className="cb-rim-chase cb-rim-bottom" />
    </div>
  );
}
