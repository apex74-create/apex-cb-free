import { useEffect } from "react";

/**
 * The CB deck's chassis treatment, lifted into a frame any app can wear:
 * heavy amber bezel and rounded corners on every control (via `apex-skin`
 * on <html>). Pure presentation — it never touches the page's layout or
 * pointer events.
 *
 * UNSTACKED 2026-11-14 (owner's order, from the watch): this frame used to
 * also carry a diagonal rainbow screen flash and a rim chase around all
 * four edges — light layers riding OVER the face. On the watch browser
 * they blanked faces and ate the graphics under them, so they are gone.
 * The frame is now a plain plate: bezel around the content, nothing over
 * the top.
 */
export default function ApexBezel({
  skin,
}: {
  skin?: "watch" | "weather" | "mesh" | "uap" | "ghost" | "mystic" | "shield" | undefined;
}) {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("apex-skin");
    return () => el.classList.remove("apex-skin");
  }, []);
  return <div className={`apex-bezel cb-bezel ${skin ? `skin-${skin}` : ""}`} aria-hidden="true" />;
}
