import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@tabler/icons-react": "@tabler/icons-react/dist/esm/icons/index.mjs",
    },
  },
  server: {
    host: "127.0.0.1",
    hmr: {
      clientPort: 4100,
      host: "127.0.0.1",
      port: 4100,
      protocol: "ws",
    },
    port: 4100,
    strictPort: true,
  },
})
