import { bindings, defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'ruleset',
    compatibilityDate: '2026-11-26',
    entrypoint: './src/index.ts',
    domains: ['ruleset.harisfox.com'],
    workersDev: false,
    assets: { basePath: '/latest', runWorkerFirst: true },
    env: {
      ASSETS: bindings.assets(),
    },
  },
});
