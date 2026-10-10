# Systems Playground

A flexible stock-and-flow canvas inspired by Donella Meadows’ *Thinking in Systems*. Stocks are accumulations; flows change them; source and sink clouds mark what sits beyond the model boundary; thin signed arrows show information links.

## On the canvas

- Add and arrange any number of stocks, source clouds, sink clouds, and flow valves.
- Connect pipes through a valve to show material moving into or out of stocks.
- Draw signed influence arrows from stocks to flow rates.
- Edit initial quantities, flow rates, names, and link polarity in the inspector.
- Scrub or play the generic stock-flow simulation. Your diagram is saved in this browser only.
- Load the bathtub starter model or clear the canvas and start from scratch.

The simulation engine is standalone TypeScript; React Flow handles the editable diagram. Fixed flow rates are adjusted by connected information links: positive links vary directly with their source stock, negative links inversely. The model is intentionally small and transparent, not a prediction engine.

## Develop

Requirements: Bun and Node.js 22+.

```sh
bun install
bun run check
bun test
bun run dev
```

## Build and deploy

This project uses the Cloudflare Vite plugin and Cloudflare’s `cf` CLI. The Worker is `systems-playground` and serves `https://systems-playground.leostera.dev`.

```sh
cf build
cf deploy
```
