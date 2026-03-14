import Docker from "dockerode"
import { config } from "./config"

export const docker = new Docker()

export const WORKER_MONITOR_PORT = "51300/tcp"
export const WORKER_PRESET_LABEL = "claudeswarm.preset"
export const WORKER_TITLE_LABEL = "claudeswarm.title"

export function getPreset(name: string) {
  const preset = config.presets.find((candidate) => candidate.name === name)

  if (!preset) {
    throw new Error(`Unknown worker preset: ${name}`)
  }

  return preset
}

export function getKnownPresetNames() {
  return new Set(config.presets.map((preset) => preset.name))
}

function isManagedContainer(container: Docker.ContainerInfo) {
  return getKnownPresetNames().has(container.Labels?.[WORKER_PRESET_LABEL] ?? "")
}

export function readPublishedPort(container: Docker.ContainerInspectInfo) {
  const hostPort =
    container.NetworkSettings.Ports?.[WORKER_MONITOR_PORT]?.[0]?.HostPort

  if (!hostPort) {
    return undefined
  }

  const port = Number.parseInt(hostPort, 10)
  return Number.isNaN(port) ? undefined : port
}

export async function findManagedContainerByPort(port: number) {
  const containers = await docker.listContainers({ all: true })

  for (const container of containers) {
    if (!isManagedContainer(container)) {
      continue
    }

    const dockerContainer = docker.getContainer(container.Id)
    const inspection = await dockerContainer.inspect()

    if (readPublishedPort(inspection) === port) {
      return dockerContainer
    }
  }

  return undefined
}
