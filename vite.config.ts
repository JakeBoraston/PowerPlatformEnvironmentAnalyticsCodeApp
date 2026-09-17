import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import * as path from 'path'
import { powerApps } from '@microsoft/power-apps-vite/plugin'

export default defineConfig({
  base: "./",
  server: {
    host: "::",
    port: 3000,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    }
  },
  plugins: [svelte(), tailwindcss(), powerApps()],
  resolve: {
    alias: {
      "$lib": path.resolve(__dirname, "./src/lib"),
      "@": path.resolve(__dirname, "./src"),
      "@generated": path.resolve(__dirname, "./src/generated"),
      "@models": path.resolve(__dirname, "./src/generated/models"),
      "@services": path.resolve(__dirname, "./src/generated/services")
    }
  }
})
