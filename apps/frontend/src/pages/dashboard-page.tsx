import { Divider } from "@heroui/react"
import { useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router"
import { WorkerSidebar } from "../components/worker-sidebar"
import { WorkerWorkspace } from "../components/worker-workspace"
import type { PresetInfo, WorkerInfo } from "../lib/api-types"
import { trpc } from "../trpc"

const MAX_CACHED_WORKSPACES = 3
const EMPTY_WORKERS: WorkerInfo[] = []
const EMPTY_PRESETS: PresetInfo[] = []

export function DashboardPage() {
  const navigate = useNavigate()
  const { port: portParam } = useParams<{ port: string }>()
  const activePort = portParam ? Number(portParam) : undefined

  const workersQuery = trpc.workers.useQuery(undefined, {
    refetchInterval: 1_000,
    refetchOnWindowFocus: false,
  })
  const presetsQuery = trpc.presets.useQuery(undefined, {
    gcTime: Number.POSITIVE_INFINITY,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const recentPortsRef = useRef<number[]>([])

  const workers = workersQuery.data ?? EMPTY_WORKERS
  const presets = presetsQuery.data ?? EMPTY_PRESETS

  // Track visited ports for caching
  useEffect(() => {
    if (activePort === undefined) return
    recentPortsRef.current = [
      activePort,
      ...recentPortsRef.current.filter((p) => p !== activePort),
    ].slice(0, MAX_CACHED_WORKSPACES)
  }, [activePort])

  const availablePorts = new Set(workers.map((w) => w.port))

  const cachedPorts = recentPortsRef.current.filter((p) => availablePorts.has(p))

  const getWorkerState = (port: number): "active" | "cached" | "unloaded" => {
    if (port === activePort) return "active"
    if (cachedPorts.includes(port)) return "cached"
    return "unloaded"
  }

  const handleWorkerDestroyed = (port: number) => {
    recentPortsRef.current = recentPortsRef.current.filter((p) => p !== port)
    if (activePort === port) {
      void navigate("/")
    }
  }

  return (
    <>
      <div className="flex min-h-screen bg-background text-foreground">
        <WorkerSidebar
          presets={presets}
          workers={workers}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {activePort && availablePorts.has(activePort) ? (
              workers.map((worker) => (
                <WorkerWorkspace
                  key={worker.port}
                  onWorkerDestroyed={handleWorkerDestroyed}
                  state={getWorkerState(worker.port)}
                  worker={worker}
                />
              ))
            ) : (
              <div className="flex h-full items-center justify-center px-6">
                <div className="max-w-lg text-center">
                  <p className="text-xs uppercase tracking-[0.26em] text-default-500">
                    Nothing selected
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

    </>
  )
}
