import type { WorkerStatus } from "./api-types"

export type DisplayWorkerStatus = WorkerStatus | "migrating"

export function formatDuration(durationS: number) {
  if (durationS < 60) {
    return `${durationS}s`
  }

  const hours = Math.floor(durationS / 3600)
  const minutes = Math.floor((durationS % 3600) / 60)

  if (hours === 0) {
    return `${minutes}m`
  }

  return `${hours}h ${minutes}m`
}

export function statusTone(status: DisplayWorkerStatus) {
  switch (status) {
    case "ready":
      return "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
    case "stopped":
      return "bg-gray-500"
    case "error":
      return "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
    case "migrating":
      return "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.55)]"
  }
}

export function formatVersionLabel(version: string) {
  const trimmed = version.trim()

  if (!trimmed) {
    return "unknown"
  }

  const digestIndex = trimmed.indexOf("@sha256:")
  if (digestIndex >= 0) {
    return trimmed.slice(digestIndex + 1)
  }

  const colonIndex = trimmed.lastIndexOf(":")
  if (colonIndex >= 0 && colonIndex < trimmed.length - 1) {
    return trimmed.slice(colonIndex + 1)
  }

  return trimmed
}
