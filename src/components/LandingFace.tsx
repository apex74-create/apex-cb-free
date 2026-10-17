import { Link } from "@tanstack/react-router";
import FaceFallbackSVG from "@/components/FaceFallbackSVG";

/**
 * Dependency-free landing face for the Android 10 watch WebView.
 *
 * This deliberately has no effects, sensors, canvas, timers, viewport reads,
 * delayed mounts, resize observers, or renderer selection. The first React
 * render is the finished face and remains the finished face.
 */
export default function LandingFace({ onEnter }: { onEnter: (view: "reel" | "grid") => void }) {
  return (
    <main className="watch-landing" aria-label="Apex Signal watch face">
      <FaceFallbackSVG strength={0.72} heading={0} className="watch-landing-art" />

      <header className="watch-landing-header">
        <h1>APEX SIGNAL</h1>
        <p>SOVEREIGN RF FIELD KIT</p>
      </header>

      <section className="watch-landing-readout" aria-label="Signal status">
        <strong>READY</strong>
        <span>STATIC VECTOR FACE</span>
      </section>

      <nav className="watch-landing-actions" aria-label="Watch face controls">
        <Link to="/face">LIVE</Link>
        <Link to="/tool/$key" params={{ key: "tremen" }}>
          MAP
        </Link>
        <button type="button" onClick={() => onEnter("grid")}>
          TOOLS
        </button>
        <Link to="/wcb" aria-label="PTT intercom — wrist CB">
          PTT
        </Link>
      </nav>

      <a
        href="/watch.html"
        className="watch-landing-faceswap"
        onClick={() => {
          try {
            window.localStorage.setItem("apex.face", "weather");
          } catch {
            /* storage blocked — the swap still works for this visit */
          }
        }}
      >
        WX FACE ›
      </a>
    </main>
  );
}
