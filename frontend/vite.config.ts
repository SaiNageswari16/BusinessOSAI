import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: {
        entry: "src/server.ts",
      }
    }),
    viteReact(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'LazyMonkeyAI',
        short_name: 'LazyMonkeyAI',
        description: 'Smart AI for Lazy Geniuses',
        theme_color: '#aa7f38',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: true,
    port: 8080,
    allowedHosts: true,
  },
});
