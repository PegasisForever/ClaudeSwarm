import { initTRPC } from "@trpc/server"
import { z } from "zod"

const t = initTRPC.create()

export const router = t.router
export const publicProcedure = t.procedure

const workerStatusSchema = z.enum(["working", "idle", "waiting", "error"])

const workerSchema = z.object({
  title: z.string(),
  status: workerStatusSchema,
  port: z.number(),
  durationS: z.number(),
  baseBranch: z.string(),
  pr: z
    .object({
      number: z.string(),
      link: z.string(),
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
  workers: publicProcedure.output(z.array(workerSchema)).query(() => {
    return []
  }),
  stopWorker: publicProcedure
    .input(
      z.object({
        port: z.number(),
      }),
    )
    .output(z.void())
    .mutation(() => {
      return undefined
    }),
  startWorker: publicProcedure
    .input(
      z.object({
        title: z.string(),
        env: z.record(z.string(), z.string()),
      }),
    )
    .output(z.object({
      port: z.number(),
    }))
    .mutation(() => {
      return {
        port: 3000,
      }
    }),
  logPage: publicProcedure
    .input(
      z.object({
        page: z.enum(["home", "about"]),
      }),
    )
    .mutation(({ input }) => {
      console.log(`[trpc] page button clicked: ${input.page}`)

      return { ok: true }
    }),
})

export type AppRouter = typeof appRouter
