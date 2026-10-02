import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/checkout/return")({
  head: () => ({
    meta: [
      { title: "Order complete — Apex Air Solutions" },
      { name: "description", content: "Your Apex purchase is complete and your licence is on your account." },
      { property: "og:title", content: "Order complete — Apex Air Solutions" },
      { property: "og:description", content: "Your Apex purchase is complete and your licence is on your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string } =>
    typeof search["session_id"] === "string"
      ? { session_id: search["session_id"] }
      : {},
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();

  return (
    <main className="min-h-dvh bg-background px-4 py-10">
      <section className="mx-auto w-full max-w-xl rounded-sm border border-border bg-card/60 p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-scan">
          Apex Air Solutions
        </p>
        <h1 className="mt-3 text-2xl font-bold">
          {sessionId ? "Thank you — your order is in" : "No order found"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {sessionId
            ? "Your licence is being added to your account now. It usually appears within a few seconds."
            : "We could not find an order for this page. If you were charged, check your account — the licence lands there automatically."}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/account"
            className="rounded-sm border border-signal/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-signal hover:bg-signal/10"
          >
            My licences
          </Link>
          <Link
            to="/store"
            className="rounded-sm border border-border px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:border-scan hover:text-scan"
          >
            Back to store
          </Link>
        </div>
      </section>
    </main>
  );
}
