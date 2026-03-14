import { initTRPC, TRPCError } from "@trpc/server"
import { readFile } from "fs/promises"
import { z } from "zod"
import { getMonitorStatus, monitorInfoSchema } from "./monitor"

const VNC_LOG_PATH = "/home/kasm-user/vnc_startup.log"
let streamConnected = false

const t = initTRPC.create()

export const router = t.router
export const publicProcedure = t.procedure

export const appRouter = router({
  health: publicProcedure
    .output(
      z.object({
        ok: z.literal(true),
      }),
    )
    .query(async () => {
      if (!streamConnected) {
        try {
          const log = await readFile(VNC_LOG_PATH, "utf-8")
          if (log.includes("Stream Connected:")) {
            streamConnected = true
          }
        } catch {
          // file doesn't exist yet
        }
      }

      if (!streamConnected) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "VNC stream not yet connected",
        })
      }

      return {
        ok: true as const,
      }
    }),
  status: publicProcedure.output(monitorInfoSchema).query(() => getMonitorStatus()),
})

export type AppRouter = typeof appRouter
