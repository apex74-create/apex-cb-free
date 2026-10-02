import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CB_LADDER,
  ADD_ONS,
  NAMED_EDITIONS,
  FARM_AG,
  OPERATOR_KITS,
  OPERATOR_RULES,
  amountLabel,
  type CbTier,
  type AddOn,
  type NamedEdition,
  type OperatorKit,
} from "@/lib/pricing";
import {
  DATA_PROMISE_TITLE,
  DATA_PROMISE_SUMMARY,
  DATA_PROMISE_POINTS,
} from "@/lib/data-promise";
import PlanBuyButton from "@/components/PlanBuyButton";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — Apex CB & Field Kit" },
      {
        name: "description",
        content:
          "CB ladder from free to Site Pro, priced by handset count. Per-handset add-ons for weather, maps, Shield and squad positioning. Named field editions and a contract-only Operator tier.",
      },
      { property: "og:title", content: "Pricing — Apex CB & Field Kit" },
      {
        property: "og:description",
        content:
          "Free three-handset CB with research licence, up through Site Pro with the 270-channel recursive scanner. Add-ons per handset. Operator / pen-test tier by contract.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const TABS = [
  { id: "ladder", label: "CB ladder" },
  { id: "addons", label: "Add-ons" },
  { id: "editions", label: "Named editions" },
  { id: "farm", label: "Farm Ag" },
  { id: "operator", label: "Operator / Pen-test" },
] as const;

function CbTierCard({ tier }: { tier: CbTier }) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-sm border p-5 ${
        tier.featured ? "border-signal/60 bg-signal/5" : "border-border/60 bg-card/40"
      }`}
    >
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">
            {tier.name}
          </h3>
          {tier.featured ? (
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-signal">
              Most taken
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{tier.tagline}</p>
      </div>

      <div>
        <p className="text-2xl font-bold tabular-nums text-foreground">{amountLabel(tier)}</p>
        {tier.perHandset ? (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {tier.perHandset}
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-sm border border-border/50 bg-background/40 p-2">
        <div>
          <dt className="text-[8px] uppercase tracking-widest text-muted-foreground">Handsets</dt>
          <dd className="text-sm font-bold tabular-nums text-foreground">{tier.handsets}</dd>
        </div>
        <div>
          <dt className="text-[8px] uppercase tracking-widest text-muted-foreground">Channels</dt>
          <dd className="text-sm font-bold tabular-nums text-foreground">{tier.channels}</dd>
        </div>
        <div>
          <dt className="text-[8px] uppercase tracking-widest text-muted-foreground">Scanner</dt>
          <dd className="text-[10px] font-bold leading-tight text-scan">{tier.scanner}</dd>
        </div>
      </dl>

      <ul className="flex flex-1 flex-col gap-2">
        {tier.includes.map((line) => (
          <li key={line} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="text-signal">·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <PlanBuyButton
        priceId={tier.contact ? null : tier.priceId}
        productSlug={tier.licenceSlug}
        label={
          tier.amountUsd === 0
            ? "Start free"
            : tier.period === "once"
              ? `Buy ${amountLabel(tier)}`
              : `Start ${amountLabel(tier)}`
        }
      />
    </div>
  );
}

function AddOnCard({ addon }: { addon: AddOn }) {
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-border/60 bg-card/40 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">
          {addon.name}
        </h3>
        <p className="text-sm font-bold tabular-nums text-signal">{amountLabel(addon)}</p>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{addon.summary}</p>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{addon.unit}</p>
    </div>
  );
}

function EditionCard({ edition }: { edition: NamedEdition }) {
  return (
    <div className="flex flex-col gap-4 rounded-sm border border-border/60 bg-card/40 p-5">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">
          {edition.name}
        </h3>
        <p className="mt-1 text-[9px] uppercase tracking-widest text-scan">{edition.handsets}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{edition.tagline}</p>
      </div>
      <p className="text-lg font-bold tabular-nums text-foreground">{edition.priceLabel}</p>
      <ul className="flex flex-1 flex-col gap-2">
        {edition.includes.map((line) => (
          <li key={line} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="text-signal">·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <PlanBuyButton
        priceId={edition.contact ? null : edition.priceId}
        productSlug={edition.licenceSlug}
        label={edition.contact ? "Talk to us" : "Buy edition"}
      />
    </div>
  );
}

function OperatorCard({ kit }: { kit: OperatorKit }) {
  return (
    <div className="flex flex-col gap-4 rounded-sm border border-alert/50 bg-alert/5 p-5">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">
            {kit.name}
          </h3>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-alert">
            Contract only
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{kit.who}</p>
      </div>
      <p className="text-lg font-bold tabular-nums text-foreground">{kit.priceLabel}</p>
      <ul className="flex flex-1 flex-col gap-2">
        {kit.includes.map((line) => (
          <li key={line} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="text-alert">·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <a
        href={`mailto:operator@apexairsolutions.com?subject=${encodeURIComponent(`${kit.name} — application`)}`}
        className="inline-block rounded-sm border border-alert/60 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-alert hover:bg-alert/10"
      >
        Contact to apply
      </a>
    </div>
  );
}

function PricingPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("ladder");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-signal">Pricing</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Price follows how many handsets you're putting on the network.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The CB ladder below is the base. Add-ons attach per handset, so Judy's walkie-talkie
          doesn't pay for weather she'll never use. Named editions bundle common setups. The
          Operator tier is contract-only.
        </p>
      </header>

      <section className="mb-10 rounded-sm border border-scan/40 bg-scan/5 p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-scan">
          {DATA_PROMISE_TITLE}
        </h2>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {DATA_PROMISE_SUMMARY}
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {DATA_PROMISE_POINTS.slice(0, 4).map((line) => (
            <li key={line} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <span className="text-scan">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <Link
          to="/agreement"
          className="mt-3 inline-block rounded-sm border border-scan/50 px-3 py-2 text-[10px] uppercase tracking-widest text-scan"
        >
          Read the whole agreement
        </Link>
      </section>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-sm border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] ${
              tab === t.id
                ? "border-signal/60 bg-signal/10 text-signal"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ladder" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CB_LADDER.map((tier) => (
              <CbTierCard key={tier.id} tier={tier} />
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Scanner tier is a real differentiator.</strong>{" "}
            80 channels on a basic tier is not the same as 80 channels with the recursive stack
            scanner sweeping 270 at a time and reporting hits up the chain instantly. That's what
            lets a foreman stay on top of a whole crew without missing a key-up.
          </p>
        </>
      ) : null}

      {tab === "addons" ? (
        <>
          <p className="mb-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Final price = base tier + add-ons × handsets. Any handset can skip an add-on it
            doesn't need, and upgrades can be bought per handset later.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ADD_ONS.map((addon) => (
              <AddOnCard key={addon.id} addon={addon} />
            ))}
          </div>
          <div className="mt-6 rounded-sm border border-signal/40 bg-signal/5 p-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-signal">
              Op Kit (high end)
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Base set + Routing Shield + Squad positioning + Signal Shield on every handset.
              One price, sized by handset count. The "hot neighborhood watch / paintball field"
              kit — no edge routers, no mesh hardware, just phones.
            </p>
          </div>
        </>
      ) : null}

      {tab === "editions" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAMED_EDITIONS.map((edition) => (
            <EditionCard key={edition.id} edition={edition} />
          ))}
        </div>
      ) : null}

      {tab === "farm" ? (
        <div className="rounded-sm border border-signal/40 bg-signal/5 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-signal">
            {FARM_AG.title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {FARM_AG.summary}
          </p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
                Pick your report cycle
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {FARM_AG.cycleOptions.map((cycle) => (
                  <li
                    key={cycle}
                    className="rounded-sm border border-border/60 bg-background/30 p-2 text-xs text-foreground"
                  >
                    {cycle}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
                What your reports unlock
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {FARM_AG.unlocks.map((line) => (
                  <li
                    key={line}
                    className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="text-signal">·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            Miss your window and the advanced tools pause until the next report lands. No ads —
            the report itself is the payment. Every report feeds the sensor array under the same
            research terms as the free CB tier.
          </p>
        </div>
      ) : null}

      {tab === "operator" ? (
        <>
          <div className="mb-5 rounded-sm border border-alert/50 bg-alert/5 p-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-alert">
              Dual-use rule
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Some of these methods can be used to harm. The Operator tier is never open sign-up.
              Every applicant goes through manual review, we reserve the right to refuse anyone
              without a reason, keys revoke on breach, and we log who holds what. The free shell
              and the CB stay wide open; the offensive-capable parts stay behind this gate.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {OPERATOR_RULES.map((rule) => (
                <li key={rule} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="text-alert">·</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {OPERATOR_KITS.map((kit) => (
              <OperatorCard key={kit.id} kit={kit} />
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Comparable tooling: Burp Suite Pro around $475 a year, Cobalt Strike around $3,500
            per user a year, Kali is free. The pricing above reflects what a licensed operator
            can do with the Foundry's methods — findings nobody else can produce.
          </p>
        </>
      ) : null}

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Early buyers keep the price they paid: prices go up as the network grows. Prices are in
        US dollars; card payment runs in test mode until the merchant account is verified.
      </p>
    </main>
  );
}
