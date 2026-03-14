import { initTRPC } from "@trpc/server"
import { z } from "zod"

const t = initTRPC.create()

export const router = t.router
export const publicProcedure = t.procedure

export const appRouter = router({
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
