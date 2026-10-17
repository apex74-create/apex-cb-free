import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DATA_PROMISE_TITLE,
  DATA_PROMISE_SUMMARY,
  DATA_PROMISE_POINTS,
  DATA_PROMISE_SHORT_EULA,
} from "@/lib/data-promise";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Apex Signal" },
      {
        name: "description",
        content:
          "Privacy policy for Apex Signal, including Supabase auth, bridge connections, content drafts, and manual Whoop notes.",
      },
      { property: "og:title", content: "Privacy — Apex Signal" },
      { property: "og:description", content: "Read how Apex Signal handles account, device, and content information." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyScreen,
});

const SECTIONS = [
  {
    title: DATA_PROMISE_TITLE,
    body: `${DATA_PROMISE_SUMMARY} ${DATA_PROMISE_POINTS.join(" ")}`,
  },
  {
    title: "The agreement, in five lines",
    body: DATA_PROMISE_SHORT_EULA.join(" "),
  },
  {
    title: "What Apex Signal stores",
    body: "Apex Signal stores only the data needed to run the product features you use. That can include account information from Supabase sign-in, saved bridge profiles, content drafts you choose to save, and any manual notes you type into the app.",
  },
  {
    title: "Bridge and device access",
    body: "Bridge connections talk to a companion agent that you run on your own phone, computer, or relay. The watch client does not run adb by itself. Device telemetry shown in the app comes from your own device, your own companion agent, or explicit not-available states.",
  },
  {
    title: "Whoop and health notes",
    body: "Whoop fields in the content workflow are manual operator inputs in the current build. Apex Signal does not automatically connect to a Whoop account in this repository state. Only the values you enter are saved with the post.",
  },
  {
    title: "Publishing and downloads",
    body: "When you publish content with the Netlify option enabled, the server sends the minimum post metadata needed to trigger the configured Netlify build hook. Android download listings are driven by the release manifest and only expose files that have actually been uploaded.",
  },
  {
    title: "Free install count",
    body: "When a browser reports installation of the free web app, we save a random receipt in that browser and one receipt in the database to avoid counting the same browser twice. The public counter shows the reported total, not a verified count of distinct people. These receipts do not contain your account, name, location, or device details. This is not a count of visitors, APK downloads, or installations made outside this site. Clearing browser storage can lead to another count on a later install.",
  },
  {
    title: "Your choices",
    body: "You can avoid saving drafts, avoid entering manual notes, and skip bridge connections if you only want to use the live web interface. If you need support or want data removed from your saved content records, use the support link shown in the app and store listing.",
  },
];

function PrivacyScreen() {
  return (
    <main className="no-scrollbar min-h-app overflow-y-auto scan-grid face-pad pb-8 pt-2">
      <header className="mb-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Link
          to="/"
          aria-label="Back"
          className="rounded-sm border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground active:bg-accent"
        >
          ‹
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[10px] font-bold uppercase tracking-widest text-signal">
            Privacy
          </h1>
          <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground">
            store policy · support-safe summary
          </p>
        </div>
        <Link
          to="/downloads"
          className="rounded-sm border border-border px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground active:bg-accent"
        >
          apk
        </Link>
      </header>

      <section className="mb-3 rounded-sm border border-signal/40 bg-signal/5 p-3">
        <p className="text-[8px] leading-relaxed text-muted-foreground">
          This page is the public privacy summary for the current Apex Signal build at{" "}
          <span className="text-signal">tinyradr.lovable.app</span>.
        </p>
        <Link
          to="/agreement"
          className="mt-2 inline-block rounded-sm border border-signal/50 px-2 py-1 text-[8px] uppercase tracking-widest text-signal"
        >
          the agreement in one minute
        </Link>
      </section>

      <div className="grid gap-2">
        {SECTIONS.map((section) => (
          <section key={section.title} className="rounded-sm border border-border bg-card/60 p-3">
            <h2 className="text-[8px] font-semibold uppercase tracking-widest text-signal">
              {section.title}
            </h2>
            <p className="mt-1 text-[7.5px] leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
