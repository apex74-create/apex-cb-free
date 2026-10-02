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
compile into the licensed native build.

**The handset-to-handset daisy chain is licensed technology and is not in
this repo.** The local link bus (`src/lib/cb-links.ts`), the field-mesh
carrier, the USB serial radio bridge, the BLE bridge, local node discovery,
private invitations and squad position sharing are all stubs here. The free
shell carries traffic over the cloud relay only — two phones on the same
channel, like any walkie app. Multi-carrier device-to-device relay (hotspot
+ BLE + USB, one channel, no server) ships with a licensed build. Stub modules under `src/lib/engines/`
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

## The echelon ladder — fork in, climb up

This repo is the free rung. Every rung above it is unlocked by shipping, not
by asking:

| Rung | You did | You get |
| --- | --- | --- |
| E0 — Fork | Cloned the shell | 3 handsets, 40 channels, linear scan, public-data weather |
| E1 — First merged PR | One pull request merged upstream | Community API key (metered), 80 channels |
| E2 — Working feature | A feature the community actually uses | 160-channel block scanner |
| E3 — Viable endpoint | A fork that stands on its own | 270-channel recursive stack scanner |
| E4 — Commercial | You sell something built on the shell | Commercial API keys, revenue-share licence |

Keys are per-contributor, metered, and revocable. Request yours at
**https://tinyradr.com/api-access** — tell us your GitHub handle and what you
are building. Every request is reviewed by hand.

The multi-carrier handset-to-handset daisy chain is **not** on this ladder.
It is the top prize and ships only under a signed licence.

## Come and get it

If you found this repo from a video or a post: yes, it really is a working
browser CB radio deck you can fork tonight. Star it, fork it, break it, send
a PR. The ladder above is real — the first merged pull request gets you a
key.
