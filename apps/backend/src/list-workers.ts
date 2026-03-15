import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import type { inferRouterOutputs } from "@trpc/server"
import type { MonitorRouterContract } from "@repo/monitor/contract"
import type Docker from "dockerode"
import {
  docker,
  getKnownPresetNames,
  readPublishedPort,
  WORKER_PRESET_LABEL,
  WORKER_TITLE_LABEL,
} from "./worker-container"

const MONITOR_TRPC_URL_PATH = "/monitor/trpc"
const MONITOR_QUERY_TIMEOUT_MS = 1_000
const WORKERS_CACHE_TTL_MS = 900

type MonitorStatusOutput = inferRouterOutputs<MonitorRouterContract>["status"]

export type WorkerInfo = {
  title: string
  preset: string
  status: "working" | "idle" | "waiting" | "error" | "stopped"
  port: number
  durationS: number
  pr?: MonitorStatusOutput["pr"]
}

const workersCache: {
  data: WorkerInfo[]
  fetchedAt: number
  promise: Promise<WorkerInfo[]> | null
} = {
  data: [],
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

async function loadWorkers(): Promise<WorkerInfo[]> {
  const knownPresets = getKnownPresetNames()
  const containers = await docker.listContainers({ all: true })

  const workerContainers = containers.filter((container) =>
    knownPresets.has(container.Labels?.[WORKER_PRESET_LABEL] ?? ""),
  )

  return Promise.all(
    workerContainers.map(async (container) => {
      const inspection = await inspectWorkerContainer(container.Id)
      const port = readPublishedPort(inspection)
      const monitorStatus = await getContainerMonitorStatus(inspection)

      return {
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
        pr: "pr" in monitorStatus ? monitorStatus.pr : undefined,
      } satisfies WorkerInfo
    }),
  )
}

export function clearWorkersCache() {
  workersCache.fetchedAt = 0
}

export async function listWorkers() {
  if (isCacheFresh()) {
    return workersCache.data
  }

  if (workersCache.promise) {
    return workersCache.promise
  }

  workersCache.promise = loadWorkers()

  try {
    const workers = await workersCache.promise
    workersCache.data = workers
    workersCache.fetchedAt = Date.now()

    return workers
  } finally {
    workersCache.promise = null
  }
}
