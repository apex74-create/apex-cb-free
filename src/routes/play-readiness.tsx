import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DATA_PROMISE_TITLE,
  DATA_PROMISE_SUMMARY,
  DATA_PROMISE_POINTS,
} from "@/lib/data-promise";
import { useEffect, useState } from "react";

/**
 * Release readiness screen — everything needed to hand the app to Google,
 * plus what to check on a real device first. Static content, no network,
 * so it works on a plane and on a watch.
 */

const APP_VERSION = "1.0.0";
const APP_ID = "app.lovable.apexsignal";
const TITLE = "Play Store Readiness — Apex Signal Watch";
const DESCRIPTION =
  "Release checklist for Apex Signal Watch: version, privacy links, sensor permissions, offline behaviour and the Android device test pass.";

export const Route = createFileRoute("/play-readiness")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayReadiness,
});

const PERMISSIONS: Array<[string, string, string]> = [
  ["Location", "Optional", "Only when you open a map, the forecast for here, or join the shared array. A rounded ~1 km cell is stored, never a precise fix."],
  ["Motion & orientation", "Optional", "Compass heading and the sextant. Asked for the first time you open those tools."],
  ["Barometer & thermometer", "Optional", "Read through the device sensor sweep to sharpen the next few forecast days. Devices without them simply say so."],
  ["Microphone", "Optional", "Push-to-talk only. Never opened unless you press to talk."],
  ["Camera", "Not used", "No camera permission is requested."],
  ["Contacts / SMS / call log", "Not used", "Never requested. Nothing on the device is read."],
  ["Network state", "Required", "Reads whether you are on Wi-Fi or cellular to score signal quality. No identifiers leave the device."],
];

const OFFLINE: Array<[string, string]> = [
  ["Watch face", "Fully offline. Time, compass and the last stored readings paint with no network."],
  ["Sun & moon compass", "Fully offline. Positions are computed on the device from the clock and your location."],
  ["Encrypted talk", "Works over any available link — mesh, Wi-Fi or relay. Queues and resends when a link returns."],
  ["Forecast", "Last successful run is cached and shown with its timestamp. New runs need a connection."],
  ["Doppler radar & maps", "Needs a connection. Shows the last frame with an offline notice otherwise."],
  ["Store & licences", "Needs a connection. Licences already granted stay unlocked offline."],
];

const CHECKLIST: Array<[string, string[]]> = [
  [
    "Splash & first launch",
    [
      "Icon on the home screen is the ring-and-wave mark, not a generic globe",
      "Splash is true black with no white flash between splash and first screen",
      "First screen loads with no sign-in wall",
      "No permission prompt appears before you touch a feature that needs one",
    ],
  ],
  [
    "OLED dark theme",
      [
      "Background reads as true black, not dark grey, on an OLED panel",
      "Neon green and amber stay legible in bright sunlight at full brightness",
      "No page has a light-mode flash while loading",
      "Status bar and navigation bar match the app background",
    ],
  ],
  [
    "Layout on real hardware",
    [
      "Phone portrait: nothing clipped, nothing needs sideways scrolling",
      "Tablet: content stays readable and does not stretch to one long line",
      "Watch (640x320 and square): the watch face fills the screen edge to edge",
      "Rotating the device does not lock or reload the app",
      "The back button on every page returns somewhere — no dead ends",
    ],
  ],
  [
    "Function pass",
    [
      "Forecast returns a sensible peak date and temperature for your location",
      "Live conditions refresh and match what is outside the window",
      "Sun and moon compass points the right way when checked against the sky",
      "Push-to-talk opens the microphone only when pressed",
      "Airplane mode: offline features above still work, online ones say so plainly",
    ],
  ],
  [
    "Store submission",
    [
      "Two or more phone screenshots captured (1080x1920 or larger)",
      "Icon 512x512 and feature graphic 1024x500 uploaded from the play-assets folder",
      "Data safety form filled to match the permissions table above",
      "Privacy policy link entered",
      "Play App Signing accepted so Google holds the key",
      "Uploaded to Internal testing and installed from Google's link",
    ],
  ],
];

const STEPS: Array<[string, string]> = [
  ["1. Create the app", "Play Console → Create app. Name: Apex Signal Watch. Default language English (US). App, not game. Free, with in-app purchases."],
  ["2. Let Google hold the key", "Release → Setup → App signing → accept 'Let Google create and manage my app signing key'. This is the step that removes the keystore problem for good: there is no file for you to make, store or lose, and every future update is signed automatically."],
  ["3. Fill the store listing", "Paste the title, short description and full description from the listing pack in the repo. Upload the icon and feature graphic from the play-assets folder, plus your screenshots."],
  ["4. Answer the forms", "Data safety (use the permissions table above), content rating (Everyone), target audience, ads (none), and the government-apps and news declarations (none apply)."],
  ["5. Upload the build", "Release → Testing → Internal testing → Create release → upload the app bundle. Add your own email as a tester."],
  ["6. Install and test", "Google gives you an opt-in link. Open it on the phone, install, and walk the checklist above."],
  ["7. Promote to production", "When the checklist passes, promote the same release from Internal testing to Production. Review usually takes a few days on a first submission."],
];

function PlayReadiness() {
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link to="/" className="text-[10px] uppercase tracking-widest text-muted-foreground">
          ‹ Home
        </Link>
        <h1 className="text-sm font-bold uppercase tracking-[0.25em] text-signal">
          Play Store readiness
        </h1>
      </header>

      <section className="mt-4 grid gap-2 sm:grid-cols-4">
        {[
          ["Version", APP_VERSION],
          ["Package", APP_ID],
          ["Running as", installed ? "Installed app" : "Browser tab"],
          ["Connection", online ? "Online" : "Offline"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-sm border border-border bg-card/60 p-3">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground">{k}</p>
            <p className="mt-1 break-words text-[11px] text-signal">{v}</p>
          </div>
        ))}
      </section>

      <section className="mt-3 rounded-sm border border-scan/40 bg-card/60 p-3">
        <h2 className="text-[9px] uppercase tracking-[0.25em] text-scan">
          Store listing: data-handling language
        </h2>
        <p className="mt-2 text-[10px] leading-relaxed text-foreground">{DATA_PROMISE_TITLE}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          {DATA_PROMISE_SUMMARY}
        </p>
        <ul className="mt-2 space-y-1">
          {DATA_PROMISE_POINTS.map((line) => (
            <li key={line} className="text-[10px] leading-relaxed text-muted-foreground">
              · {line}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[9px] uppercase tracking-widest text-muted-foreground">
          Paste into the Play Console listing and the Data safety form; matches the privacy page
          word for word.
        </p>
      </section>

      <section className="mt-3 rounded-sm border border-border bg-card/60 p-3">
        <h2 className="text-[9px] uppercase tracking-[0.25em] text-scan">Privacy &amp; policy</h2>
        <ul className="mt-2 space-y-1 text-[10px] uppercase tracking-widest">
          <li>
            <Link to="/library" className="text-signal underline">
              Papers &amp; policy library
            </Link>
          </li>
          <li>
            <Link to="/account" className="text-signal underline">
              Account &amp; data deletion
            </Link>
          </li>
          <li className="text-muted-foreground">
            Support contact: the address on the store listing
          </li>
        </ul>
        <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
          No data is sold or shared with third parties. Shared-array readings are coarse and
          anonymous; raw rows are never readable by anyone, only the aggregate.
        </p>
      </section>

      <section className="mt-3 rounded-sm border border-border bg-card/60 p-3">
        <h2 className="text-[9px] uppercase tracking-[0.25em] text-scan">Sensors &amp; permissions</h2>
        <ul className="mt-2 space-y-2">
          {PERMISSIONS.map(([name, need, why]) => (
            <li key={name}>
              <p className="text-[10px] uppercase tracking-widest text-signal">
                {name} · <span className="text-muted-foreground">{need}</span>
              </p>
              <p className="text-[9px] leading-relaxed text-muted-foreground">{why}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-3 rounded-sm border border-border bg-card/60 p-3">
        <h2 className="text-[9px] uppercase tracking-[0.25em] text-scan">Works without a signal</h2>
        <ul className="mt-2 space-y-1">
          {OFFLINE.map(([name, note]) => (
            <li key={name} className="text-[9px] leading-relaxed text-muted-foreground">
              <span className="text-signal">{name}</span> — {note}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-3 space-y-2">
        {CHECKLIST.map(([group, items]) => (
          <div key={group} className="rounded-sm border border-border bg-card/60 p-3">
            <h2 className="text-[9px] uppercase tracking-[0.25em] text-scan">{group}</h2>
            <ul className="mt-2 space-y-1">
              {items.map((item) => (
                <li key={item} className="flex gap-2 text-[9px] leading-relaxed text-muted-foreground">
                  <span aria-hidden className="text-signal">▢</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-3 rounded-sm border border-signal/40 bg-card/60 p-3">
        <h2 className="text-[9px] uppercase tracking-[0.25em] text-signal">
          Handing it to Google — every step in the browser
        </h2>
        <ol className="mt-2 space-y-2">
          {STEPS.map(([step, detail]) => (
            <li key={step}>
              <p className="text-[10px] uppercase tracking-widest text-signal">{step}</p>
              <p className="text-[9px] leading-relaxed text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
          If you would rather not use the Play Store at all, the app installs straight from the web:
          open the site on the phone and use Install. It runs full screen, offline, with the same
          icon and splash — no store, no review, no key. The store only adds discovery and automatic
          updates.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://play.google.com/console"
            target="_blank"
            rel="noreferrer"
            className="rounded-sm border border-signal/60 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-signal hover:bg-signal/10"
          >
            Open Play Console
          </a>
          <Link
            to="/downloads"
            className="rounded-sm border border-border px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:border-scan hover:text-scan"
          >
            Downloads
          </Link>
        </div>
      </section>

      <p className="mt-4 text-[8px] uppercase tracking-widest text-muted-foreground">
        The artwork Google asks for is already in the repository: icon 512x512 and feature graphic
        1024x500 in the play-assets folder.
      </p>
    </main>
  );
}
