import { TRPCError, initTRPC } from "@trpc/server"
import { z } from "zod"
import { destroyWorkerContainer } from "./destroy-worker"
import { listWorkers } from "./list-workers"
import { startWorkerContainer } from "./start-worker"
import { config } from "./config"
import { resolveWorkerByIp, WORKER_PARENT_LABEL } from "./worker-container"

export type TRPCContext = {
  clientIp: string | undefined
}

const t = initTRPC.context<TRPCContext>().create()

export const router = t.router
export const publicProcedure = t.procedure

const workerStatusSchema = z.enum([
  "working",
  "idle",
  "waiting",
  "error",
  "stopped",
])

const workerSchema = z.object({
  id: z.string(),
  title: z.string(),
  preset: z.string(),
  status: workerStatusSchema,
  port: z.number(),
  durationS: z.number(),
  createdAt: z.number(),
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

const workersSchema = z.object({
  workers: z.array(workerSchema),
  hierarchy: z.record(z.string(), z.array(z.string())),
})

const presetsSchema = z.array(
  z.object({
    name: z.string(),
    imageTag: z.string(),
    requiredEnv: z.array(z.string()),
  }),
)

const workerOutputs = new Map<string, string>()

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
  presets: publicProcedure.output(presetsSchema).query(() => {
    return config.presets
  }),
  workers: publicProcedure.output(workersSchema).query(async () => {
    return listWorkers()
  }),
  destroyWorker: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .output(z.void())
    .mutation(async ({ input }) => {
      try {
        await destroyWorkerContainer(input.id)
        return undefined
      } catch (error) {
        console.error("[destroyWorker] failed to destroy worker", error)

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to destroy worker",
          cause: error,
        })
      }
    }),
  startWorker: publicProcedure
    .input(
      z.object({
        title: z.string(),
        preset: z.string(),
        env: z.record(z.string(), z.string()),
      }),
    )
    .output(
      z.object({
        id: z.string(),
        port: z.number(),
        healthy: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        let parentId: string | undefined

        if (ctx.clientIp) {
          const caller = await resolveWorkerByIp(ctx.clientIp)

          if (caller) {
            if (caller.parentId) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "Sub-workers cannot create workers",
              })
            }

            parentId = caller.id
          }
        }

        return await startWorkerContainer({
          ...input,
          labels: parentId ? { [WORKER_PARENT_LABEL]: parentId } : undefined,
        })
      } catch (error) {
        if (error instanceof TRPCError) throw error

        console.error("[startWorker] failed to start worker", error)

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to start worker",
          cause: error,
        })
      }
    }),
  setWorkerOutput: publicProcedure
    .input(
      z.object({
        output: z.string(),
      }),
    )
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      if (!ctx.clientIp) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Unable to determine caller IP",
        })
      }

      const caller = await resolveWorkerByIp(ctx.clientIp)

      if (!caller) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Caller is not a managed worker",
        })
      }

      workerOutputs.set(caller.id, input.output)
      return undefined
    }),
  getWorkerOutput: publicProcedure
    .input(
      z.object({
        workerId: z.string(),
      }),
    )
    .output(
      z.object({
        status: workerStatusSchema.nullable(),
        output: z.string().nullable(),
      }),
    )
    .query(async ({ input }) => {
      const { workers } = await listWorkers()
      const worker = workers.find((w) => w.id === input.workerId)

      return {
        status: worker?.status ?? null,
        output: workerOutputs.get(input.workerId) ?? null,
      }
    }),
})

export type AppRouter = typeof appRouter
