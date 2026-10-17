import { createPortalSession } from "@/utils/payments.functions";
import { getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyLicences, listProducts } from "@/lib/catalog.functions";
import { priceLabel } from "@/lib/catalog";
import { useSession } from "@/lib/cloud";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "My licences — Apex Air Solutions";
const DESCRIPTION =
  "Your Apex Air Solutions account: the products you own, their licence keys and every download they unlock.";

export const Route = createFileRoute("/account")({
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
  loader: () => listProducts(),
  errorComponent: () => (
    <main className="min-h-app px-4 py-6 text-[11px] text-alert">
      Your account could not be loaded. Try again shortly.
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-app px-4 py-6 text-[11px] text-muted-foreground">Nothing here.</main>
  ),
  component: AccountPage,
});

function AccountPage() {
  const products = Route.useLoaderData();
  const { session, loading } = useSession();
  const fetchLicences = useServerFn(listMyLicences);

  const licences = useQuery({
    queryKey: ["licences", session?.user.id ?? "anon"],
    queryFn: () => fetchLicences(),
    enabled: Boolean(session),
  });

  const owned = new Set((licences.data ?? []).map((l) => l.product_slug));

  return (
    <main className="no-scrollbar min-h-app overflow-y-auto scan-grid px-4 py-6 text-foreground">
      <header className="mx-auto w-full max-w-3xl">
        <p className="text-[10px] uppercase tracking-[0.3em] text-scan">Apex Air Solutions</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-signal sm:text-3xl">
          My licences
        </h1>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          {session?.user.email
            ? `Signed in as ${session.user.email}.`
            : "Sign in to see what you own."}
        </p>
        {session ? (
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Release every device on this account? The next device that opens a paid feature becomes the new one.")) return;
              const { error } = await supabase.from("licence_devices").delete().eq("user_id", session.user.id);
              alert(error ? "Could not release devices. Try again." : "Devices released. Open the app on your new device.");
            }}
            className="mt-2 rounded-sm border border-border px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-scan hover:text-scan"
          >
            Move to a new device
          </button>
        ) : null}
        {session && paymentsConfigured() ? (
          <button
            type="button"
            onClick={async () => {
              const tab = window.open("", "_blank");
              const r = await createPortalSession({
                data: { returnUrl: window.location.href, environment: getStripeEnvironment() },
              });
              if ("error" in r) {
                tab?.close();
                alert(r.error);
                return;
              }
              if (tab) tab.location.href = r.url;
              else window.location.href = r.url;
            }}
            className="ml-2 mt-2 rounded-sm border border-signal/60 px-3 py-1 text-[10px] uppercase tracking-widest text-signal hover:bg-signal/10"
          >
            Manage billing
          </button>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/store"
            className="rounded-sm border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-scan hover:text-scan"
          >
            Store
          </Link>
          <Link
            to="/downloads"
            className="rounded-sm border border-border px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:border-scan hover:text-scan"
          >
            Downloads
          </Link>
        </div>
      </header>

      {!loading && !session ? (
        <section className="mx-auto mt-4 w-full max-w-3xl rounded-sm border border-signal/40 bg-card/60 p-4">
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            You are not signed in. One account carries every product you buy, on the watch, the
            phone and the desktop.
          </p>
          <Link
            to="/auth"
            className="mt-3 inline-block rounded-sm border border-signal/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-signal hover:bg-signal/10"
          >
            Sign in
          </Link>
        </section>
      ) : null}

      {session ? (
        <section className="mx-auto mt-4 w-full max-w-3xl">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            What you own
          </h2>
          {licences.isLoading ? (
            <p className="text-[11px] text-muted-foreground">Checking your licences…</p>
          ) : owned.size === 0 ? (
            <p className="rounded-sm border border-border bg-card/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
              No licences on this account yet. Anything you buy shows up here straight away, with
              its key and downloads.
            </p>
          ) : (
            <ul className="space-y-2">
              {(licences.data ?? []).map((licence) => {
                const product = products.find((p) => p.slug === licence.product_slug);
                return (
                  <li
                    key={licence.licence_key}
                    className="rounded-sm border border-signal/50 bg-card/60 p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11px] font-bold uppercase tracking-widest text-signal">
                        {product?.name ?? licence.product_slug}
                      </span>
                      <span className="shrink-0 text-[9px] uppercase tracking-widest text-muted-foreground">
                        {licence.expires_at ? `until ${licence.expires_at.slice(0, 10)}` : "perpetual"}
                      </span>
                    </div>
                    <p className="mt-1 break-all font-mono text-[10px] text-scan">
                      {licence.licence_key}
                    </p>
                    {product?.downloads.length ? (
                      <ul className="mt-2 space-y-1">
                        {product.downloads.map((download) => (
                          <li key={download.id} className="text-[10px] text-muted-foreground">
                            {download.available ? (
                              <a href={download.url} className="text-signal underline">
                                {download.label}
                              </a>
                            ) : (
                              <span>{download.label} — pending release</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <section className="mx-auto mt-5 w-full max-w-3xl">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Everything else in the catalogue
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {products
            .filter((p) => !owned.has(p.slug))
            .map((product) => (
              <Link
                key={product.slug}
                to="/store/$slug"
                params={{ slug: product.slug }}
                className="block rounded-sm border border-border bg-card/50 p-3 hover:border-scan"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[10.5px] font-bold uppercase tracking-widest text-foreground">
                    {product.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {priceLabel(product)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  {product.tagline || "Details coming soon."}
                </p>
              </Link>
            ))}
        </div>
      </section>
    </main>
  );
}
