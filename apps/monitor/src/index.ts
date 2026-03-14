import { createBunServeHandler } from "trpc-bun-adapter"
import { appRouter } from "./router"

function readEnv(name: string, fallback?: string) {
  return process.env[name] ?? fallback
}

const port = Number(readEnv("PORT", "3000"))
const host = readEnv("HOST", "0.0.0.0")

Bun.serve(
  createBunServeHandler(
    {
      endpoint: "/api/trpc",
      router: appRouter,
    },
    {
      port,
      hostname: host,
    },
  ),
)

console.log(`[monitor] listening on http://0.0.0.0:3000`)
