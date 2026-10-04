# Contributing to Apex CB Shell

Thanks for building on the shell. These terms keep the free fork free
while protecting the licensed engines that fund it.

## The rules

1. **Fork freely** for personal and non-commercial use.
.2 **Commercial use requires a licence** — hosting it as a service,
   bundling it into a paid product, or reselling it. Contact the owner
   before you ship.
3. **Contributions back** — by opening a PR you grant the project owner a
   perpetual licence to use your contribution in both the open and
   private trees.
4. **Proprietary engines are not in this repo** — stub modules mark the
   boundary. Do not submit PRs that attempt to reconstruct the synthesis
   engines, the daisy-chain relay, token minting, or licence signing.
5. **Terminology** — the word is “token” technical identifier, never “coin”
   or anything financial.

## How to contribute

1. Pick a `good first issue` or open an issue describing what you want to
   build.
2. Fork, branch, build, test.
3. Open a PR against `main`. Keep it focused — one thing per PR.
4. The owner reviews. Merged PRs earn ladder badges — see [BADGES.md](BADGES.md).

## What makes a good PR

- Touches only the shell (UI, routes, PWA assets, public protocol surface).
- No new dependencies without discussion.
- No secrets, keys, or customer data — ever.
- Works offline-first where possible; this is a towers-down product.
