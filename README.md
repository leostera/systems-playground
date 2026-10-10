# Systems Playground

An interactive systems-dynamics playground inspired by Donella Meadows’ *Thinking in Systems*. Start with a renewable commons: people draw from a shared resource, the resource regenerates, and resource scarcity feeds back into population growth.

## Explore

- Drag stocks around the causal-loop diagram and follow the signed feedback links.
- Change regeneration, per-person use, population growth, and the simulation horizon.
- Watch the stocks change over time, then scrub or play through the simulation.
- Everything runs in the browser; no account or data collection is involved.

The simulation engine is a standalone TypeScript model. React Flow presents the system structure; it does not own the model logic.

## Develop

Requirements: Bun and Node.js 22+.

```sh
bun install
bun run check
bun test
bun run dev
```

## Build and deploy

This project uses the Cloudflare Vite plugin and Cloudflare’s `cf` CLI. The Worker is `systems-playground`; the intended public hostname is `https://systems-playground.leostera.dev`.

```sh
cf build
cf deploy
```
