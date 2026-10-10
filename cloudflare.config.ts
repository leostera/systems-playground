import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "systems-playground",
    compatibilityDate: "2026-10-10",
    entrypoint,
    assets: {
      notFoundHandling: "single-page-application",
    },
    domains: ["systems-playground.leostera.dev"],
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true, headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
    env: {
      ASSETS: bindings.assets(),
    },
  },
});
