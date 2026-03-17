import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import type { inferRouterOutputs } from "@trpc/server"
import type { MonitorRouterContract } from "@repo/monitor/contract"
import type Docker from "dockerode"
import {
  docker,
  getKnownPresetNames,
  readPublishedPort,
  WORKER_PARENT_LABEL,
  WORKER_PRESET_LABEL,
  WORKER_TITLE_LABEL,
} from "./worker-container"

const MONITOR_TRPC_URL_PATH = "/monitor/trpc"
const MONITOR_QUERY_TIMEOUT_MS = 1_000
const WORKERS_CACHE_TTL_MS = 900

type MonitorStatusOutput = inferRouterOutputs<MonitorRouterContract>["status"]

export type WorkerInfo = {
  id: string
  title: string
  preset: string
  status: "working" | "idle" | "waiting" | "error" | "stopped"
  port: number
  durationS: number
  createdAt: number
  pr?: MonitorStatusOutput["pr"]
}

export type WorkersResult = {
  workers: WorkerInfo[]
  hierarchy: Record<string, string[]>
}

const workersCache: {
  data: WorkersResult
  fetchedAt: number
  promise: Promise<WorkersResult> | null
} = {
  data: { workers: [], hierarchy: {} },
  fetchedAt: 0,
  promise: null,
}

function isCacheFresh() {
  return Date.now() - workersCache.fetchedAt <= WORKERS_CACHE_TTL_MS
}

function createMonitorClient(ipAddress: string, port: number) {
  return createTRPCProxyClient<MonitorRouterContract>({
    links: [
      httpBatchLink({
        url: `http://${ipAddress}:${port}${MONITOR_TRPC_URL_PATH}`,
      }),
    ],
  })
}

async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

function parseStartedAtMs(isoTimestamp?: string) {
  if (!isoTimestamp || isoTimestamp.startsWith("0001-01-01")) {
    return undefined
  }

  const timestamp = Date.parse(isoTimestamp)
  return Number.isNaN(timestamp) ? undefined : timestamp
}

function getDurationS(
  container: Docker.ContainerInspectInfo,
  createdAtUnixSeconds: number,
) {
  const startedAtMs = parseStartedAtMs(container.State.StartedAt)
  const createdAtMs = createdAtUnixSeconds * 1_000
  const baseTimestamp = startedAtMs ?? createdAtMs

  return Math.max(0, Math.floor((Date.now() - baseTimestamp) / 1_000))
}

async function getContainerMonitorStatus(
  container: Docker.ContainerInspectInfo,
): Promise<MonitorStatusOutput | { status: "error" | "stopped" }> {
  if (!container.State.Running) {
    return {
      status: "stopped" as const,
    }
  }

  const healthStatus = container.State.Health?.Status

  if (healthStatus !== undefined && healthStatus !== "healthy") {
    return {
      status: "error" as const,
    }
  }

  try {
    const network = Object.values(container.NetworkSettings.Networks)[0]
    if (!network) {
      throw new Error("No network found for container")
    }

    const client = createMonitorClient(network.IPAddress, 51300)
    return await withTimeout(
      () => client.status.query(),
      MONITOR_QUERY_TIMEOUT_MS,
    )
  } catch (error) {
    console.error(
      `[workers] failed to query monitor status for container ${container.Id}`,
      error,
    )

    return {
      status: "error" as const,
    }
  }
}

async function inspectWorkerContainer(containerId: string) {
  return docker.getContainer(containerId).inspect()
}

async function loadWorkers(): Promise<WorkersResult> {
  const knownPresets = getKnownPresetNames()
  const containers = await docker.listContainers({ all: true })

  const workerContainers = containers.filter((container) =>
    knownPresets.has(container.Labels?.[WORKER_PRESET_LABEL] ?? ""),
  )

  const allWorkers = await Promise.all(
    workerContainers.map(async (container) => {
      const inspection = await inspectWorkerContainer(container.Id)
      const port = readPublishedPort(inspection)
      const monitorStatus = await getContainerMonitorStatus(inspection)

      const parentId =
        inspection.Config.Labels?.[WORKER_PARENT_LABEL] ??
        container.Labels?.[WORKER_PARENT_LABEL] ??
        undefined

      return {
        parentId,
        info: {
          id: container.Id,
          title:
            inspection.Config.Labels?.[WORKER_TITLE_LABEL] ??
            container.Labels?.[WORKER_TITLE_LABEL] ??
            inspection.Name.replace(/^\//, ""),
          preset:
            inspection.Config.Labels?.[WORKER_PRESET_LABEL] ??
            container.Labels?.[WORKER_PRESET_LABEL] ??
            "unknown",
          status: monitorStatus.status,
          port: port ?? 0,
          durationS: getDurationS(inspection, container.Created),
          createdAt: container.Created,
          pr: "pr" in monitorStatus ? monitorStatus.pr : undefined,
        } satisfies WorkerInfo,
      }
    }),
  )

  // Sort by creation time, newest first
  allWorkers.sort((a, b) => b.info.createdAt - a.info.createdAt)

  const workers: WorkerInfo[] = allWorkers.map((w) => w.info)

  // Build hierarchy: parentId -> [childId, ...]
  const hierarchy: Record<string, string[]> = {}
  for (const w of allWorkers) {
    if (w.parentId) {
      const children = hierarchy[w.parentId] ?? []
      children.push(w.info.id)
      hierarchy[w.parentId] = children
    }
  }

  return { workers, hierarchy }
}

export function clearWorkersCache() {
  workersCache.fetchedAt = 0
}

export async function listWorkers(): Promise<WorkersResult> {
  if (isCacheFresh()) {
    return workersCache.data
  }

  if (workersCache.promise) {
    return workersCache.promise
  }

  workersCache.promise = loadWorkers()

  try {
    const result = await workersCache.promise
    workersCache.data = result
    workersCache.fetchedAt = Date.now()

    return result
  } finally {
    workersCache.promise = null
  }
}
