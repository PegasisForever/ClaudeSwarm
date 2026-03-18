import type Docker from "dockerode"
import { clearWorkersCache } from "./list-workers"
import { findManagedContainerById, readPublishedPort } from "./worker-container"

const HEALTH_POLL_INTERVAL_MS = 1_000
const HEALTH_TIMEOUT_MS = 60_000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHealth(container: Docker.Container) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS

  while (Date.now() < deadline) {
    const inspection = await container.inspect()
    const healthStatus = inspection.State.Health?.Status

    if (healthStatus === "healthy") {
      return
    }

    if (healthStatus === "unhealthy") {
      throw new Error("Worker container became unhealthy")
    }

    if (!inspection.State.Running) {
      throw new Error("Worker container stopped before becoming healthy")
    }

    await sleep(HEALTH_POLL_INTERVAL_MS)
  }

  throw new Error("Timed out waiting for worker container health check")
}

export async function startManagedWorkerContainer(id: string) {
  const container = await findManagedContainerById(id)

  if (!container) {
    throw new Error(`No managed worker found for id ${id}`)
  }

  const initialInspection = await container.inspect()
  if (!initialInspection.State.Running) {
    await container.start()
  }

  const inspection = await container.inspect()
  const port = readPublishedPort(inspection)

  if (port === undefined) {
    throw new Error("Docker did not publish a host port for worker container")
  }

  let healthy = false
  try {
    await waitForHealth(container)
    healthy = true
  } catch (error) {
    console.error("[startManagedWorker] worker is reachable but not healthy yet", error)
  }

  clearWorkersCache()
  return { id, port, healthy }
}

export async function stopManagedWorkerContainer(id: string) {
  const container = await findManagedContainerById(id)

  if (!container) {
    throw new Error(`No managed worker found for id ${id}`)
  }

  const inspection = await container.inspect()
  if (inspection.State.Running) {
    await container.stop()
  }

  clearWorkersCache()
}
