import { initTRPC } from "@trpc/server"
import { z } from "zod"
import { monitorInfoSchema } from "./monitor/schema"

const t = initTRPC.create()

export const monitorRouterContract = t.router({
  health: t.procedure
    .output(
      z.object({
        ok: z.literal(true),
      }),
    )
    .query(() => {
      return {
        ok: true as const,
      }
    }),
  status: t.procedure.output(monitorInfoSchema).query(() => {
    return {
      status: "idle" as const,
    }
  }),
})

export type MonitorRouterContract = typeof monitorRouterContract
