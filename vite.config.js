import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(`v${pkg.version} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`) },
  plugins: [svelte()],
  clearScreen: false,
  server: { port: 5273, strictPort: true },
  build: { target: 'safari15', emptyOutDir: true }
})
