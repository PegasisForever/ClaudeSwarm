export type WorkerPullRequest = {
  baseBranch: string
  branch: string
  link: string
  name: string
  number: string
}

export type WorkerStatus = "working" | "idle" | "waiting" | "error" | "stopped"

export type PresetInfo = {
  imageTag: string
  name: string
  requiredEnv: string[]
}

export type WorkerInfo = {
  id: string
  durationS: number
  port: number
  createdAt: number
  pr?: WorkerPullRequest
  preset: string
  status: WorkerStatus
  title: string
}

export type WorkersResponse = {
  workers: WorkerInfo[]
  hierarchy: Record<string, string[]>
}

export type StartWorkerInput = {
  env: Record<string, string>
  preset: string
  title: string
}
