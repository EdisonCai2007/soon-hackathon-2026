import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  // `@/` is app/src/, the address the ready-made parts import each other by.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // The Worker reads the setup script from the repo's own scripts/, above this root, with `?raw`. The dev
  // server serves nothing outside its roots unless told, and refuses to start at all without this.
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
})
