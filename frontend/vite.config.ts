import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: {
      entry: "server",
    },
  },

  vite: {
    server: {
      host: true,
      port: 8080,
      allowedHosts: true,
    },
    resolve: {
      tsconfigPaths: true,
    },
  },
});