/**
 * Browser half: one self-registering IIFE. Nothing is external: platform
 * modules (React, ui-primitives) arrive through the factory `require` argument
 * of `window.__ModuleLoader__.load`, never through a bundle-level import.
 */
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: ['iife'],
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false,
  sourcemap: true,
  outExtensions: () => ({ js: '.js' }),
  outputOptions: { entryFileNames: 'client.js' },
})
