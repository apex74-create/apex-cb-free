import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import cbEntryRadioArt from "@/assets/cb-entry-radio.jpg";
import IphoneSafariInstallGuide from "@/components/IphoneSafariInstallGuide";
import { useSession } from "@/lib/cloud";
import { CB_OG_IMAGE, CB_SHARE_URL } from "@/lib/cb-routes";
const radioArt = cbEntryRadioArt;

export const Route = createFileRoute("/cb-welcome")({
  head: () => ({ links: [{ rel: "canonical", href: CB_SHARE_URL }], meta: [
    { title: "Sovereign CB — Sign in & install" },
    { name: "description", content: "Enter Sovereign CB, sign in to your Apex account, or install the standalone radio." },
    { property: "og:title", content: "Sovereign CB — Sign in & install" },
    { property: "og:description", content: "Your standalone CB radio entry: sign in, install, or open the radio." },
    { property: "og:type", content: "website" },
    { property: "og:url", content: CB_SHARE_URL },
    { property: "og:image", content: CB_OG_IMAGE },
    { name: "twitter:image", content: CB_OG_IMAGE },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CbEntry,
});

function CbEntry() {
  const { session } = useSession();
  return (
    <main className="cb-entry relative flex min-h-app flex-col justify-end overflow-hidden bg-background text-foreground">
      <img src={radioArt} alt="Sovereign handheld CB radio" className="absolute inset-0 h-full w-full object-cover object-top" />
      <div className="absolute inset-0 bg-background/60" />
      <div className="relative z-10 mx-auto w-full max-w-3xl px-5 pb-10 pt-16 sm:pb-16">
        <p className="text-xs font-bold uppercase text-warn">Apex Signal · standalone radio</p>
        <h1 className="mt-2 text-4xl font-bold uppercase text-foreground sm:text-6xl">Sovereign CB</h1>
        <p className="mt-4 max-w-lg text-sm text-foreground">Your channel is ready.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild><Link to="/cb">Open radio →</Link></Button>
          {!session ? <Button variant="outline" asChild><Link to="/auth" search={{ next: "/cb" }}>Sign in</Link></Button> : null}
          <Button variant="outline" asChild><Link to="/cb">Open &amp; install</Link></Button>
        </div>
        <div className="mt-6"><IphoneSafariInstallGuide /></div>
        <Link to="/store" className="mt-6 inline-block text-sm text-muted-foreground underline">Sales</Link>
      </div>
    </main>
  );
}
