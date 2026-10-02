# Apex CB — community shell

The free, forkable shell of Apex Signal / TinyRadr: a browser CB radio deck,
offline-first PWA, live conditions and a public-data weather view. Fork it,
build something on it, make it better — and when you ship it commercially,
that is where the licence comes in.

## What is in here

- `src/routes/` — CB radio deck UI, watch faces, map, pricing page, store and
  auth shells. The engine-showcase screens are not part of the shell.
- `src/components/` — UI primitives and the project chrome.
- `src/lib/cb-links.ts`, `src/lib/cb-routes.ts`, `src/lib/rooms.ts` — the
  carrier bus and room routing (public protocol surface). Rooms `19` / `19.1`
  / `19.1.1`, bus `ptt-<id>`; `tune()` takes `{ roomId, key }`.
- `src/lib/engines/tristar-addressing.ts` — the wire-format header carried on
  every digital-link frame (public protocol).
- `src/lib/pricing.ts` — display copy and tier data only.
- `public/cb.webmanifest` + icons, service worker — installable PWA assets.
- `src/routes/api/public/forecast.ts` — a direct Open-Meteo pass-through so
  the weather UI runs with no engine.

## What is deliberately NOT in here

The proprietary math. The synthesis engines, wave-collapse forecast logic,
the shield's scoring and timing parameters, the operator field scripts, token
minting, licence signing and device binding all live in the private tree and
compile into the licensed native build. Stub modules under `src/lib/engines/`
keep the shell's type surface intact and degrade gracefully; `src/lib/papers.ts`
is an empty stub — the paper library is private.

**The community shell is the dining room. The kitchen is not in this repo.**

## Quickstart

```sh
bun install        # or npm install / pnpm install
cp .env.example .env   # plug your own Supabase/Lovable Cloud project
bun run dev
```

The CB deck, watch faces and PWA install work with no backend at all. Auth,
the store catalogue and licence checks need the Supabase environment
variables — create your own project and fill them in.

## Contributor terms

- **Fork freely** for personal and non-commercial use.
- **Commercial use** — hosting it as a service, bundling it into a paid
  product, reselling it — requires a licence and revenue share. Contact the
  owner for terms.
- **Contributions back are welcome.** By opening a pull request you grant the
  project owner a perpetual licence to use your contribution in both the open
  and the private tree.
- **API keys** for the proprietary engines are issued per contributor, metered
  and revocable. The free tier covers community development; paid tiers are
  for anything shipping to end users. Request keys through the store page on
  [tinyradr.com](https://tinyradr.com).

## Licence

See [LICENSE](LICENSE). Fork, learn, build, contribute — the protected math
and the operator scripts stay with the owner.
