import { initTRPC } from "@trpc/server"
import { z } from "zod"

const t = initTRPC.create()

export const router = t.router
export const publicProcedure = t.procedure

const statusSchema = z.object({
  status: z.enum(["working", "idle", "waiting"]),
  pr: z
    .object({
      name: z.string(),
      number: z.string(),
      link: z.string(),
      branch: z.string(),
      baseBranch: z.string(),
    })
    .optional(),
})

export const appRouter = router({
  health: publicProcedure
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
  status: publicProcedure.output(statusSchema).query(() => {
    return {
      status: "idle",
    }
  }),
})

export type AppRouter = typeof appRouter
