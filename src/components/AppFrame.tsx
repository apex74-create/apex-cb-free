import { useEffect, useState } from "react";
import { ZStackPanels } from "@/components/ZStackPanels";
import { SKINS, type SkinId } from "@/lib/skins";
import { ShieldMaps, ShieldReferences, ShieldWork } from "@/components/ShieldSheets";

function WeatherLeft() {
  const [position, setPosition] = useState<string>("Position not requested");
  const locate = () => {
    if (!navigator.geolocation) { setPosition("Position unavailable"); return; }
    setPosition("Locating…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPosition(`${coords.latitude.toFixed(3)}°, ${coords.longitude.toFixed(3)}° · GPS ±${Math.round(coords.accuracy)}m`),
      () => setPosition("Position unavailable · permission or signal"),
      { timeout: 8000, maximumAge: 300000 },
    );
  };
  return <div className="space-y-2 text-xs normal-case">
    <p role="status">{position}</p>
    <button type="button" onClick={locate} className="app-hbtn px-3 py-2">Read position</button>
  </div>;
}

function WeatherTool({ path, label }: { path: string; label: string }) {
  return <div className="flex min-h-0 flex-1 flex-col pt-2">
    <iframe title={label} src={`${path}?panel=1`} loading="lazy" className="min-h-0 w-full flex-1 rounded-lg border border-border bg-background" />
    <a href={path} className="app-hbtn mt-2 mb-9 self-end px-3 py-1 text-xs">Open full {label}</a>
  </div>;
}

export function AppFrame({ skin }: { skin: SkinId }) {
  const [panel, setPanel] = useState(false);
  const [shieldView, setShieldView] = useState<"defense" | "tremor" | "bruce">("defense");
  useEffect(() => setPanel(new URLSearchParams(window.location.search).has("panel")), []);
  useEffect(() => {
    if (skin !== "shield") return;
    const listener = (e: Event) => setShieldView((e as CustomEvent<"defense" | "tremor" | "bruce">).detail);
    window.addEventListener("apex:shield-view", listener);
    return () => window.removeEventListener("apex:shield-view", listener);
  }, [skin]);
  if (panel) return null;
  return <ZStackPanels skin={SKINS[skin]}
    {...(skin === "weather" ? {
      leftExtra: <WeatherLeft />,
      rightExtra: <WeatherTool path="/observe" label="ground checks" />,
      upExtra: <WeatherTool path="/doppler" label="Doppler radar" />,
    } : {})}
    {...(skin === "shield" ? {
      leftExtra: <ShieldReferences />,
      rightExtra: <ShieldWork />,
      upExtra: <ShieldMaps active={shieldView} onSelect={(view) => { setShieldView(view); window.dispatchEvent(new CustomEvent("apex:shield-select", { detail: view })); }} />,
    } : {})}
  />;
}