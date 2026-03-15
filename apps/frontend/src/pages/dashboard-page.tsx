import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { WorkerSidebar } from "../components/worker-sidebar"
import { WorkerWorkspace } from "../components/worker-workspace"
import { trpc } from "../trpc"

const MAX_CACHED_WORKSPACES = 3

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
  const [recentPorts, setRecentPorts] = useState<number[]>([])
  const [prevActivePort, setPrevActivePort] = useState<number | undefined>()

  const workers = workersQuery.data ?? []
  const presets = presetsQuery.data ?? []

  if (activePort !== undefined && activePort !== prevActivePort) {
    setPrevActivePort(activePort)
    setRecentPorts((prev) =>
      [activePort, ...prev.filter((p) => p !== activePort)].slice(
        0,
        MAX_CACHED_WORKSPACES,
      ),
    )
  }

  const availablePorts = new Set(workers.map((w) => w.port))

  const cachedPorts = recentPorts.filter((p) => availablePorts.has(p))

  const getWorkerState = (port: number): "active" | "cached" | "unloaded" => {
    if (port === activePort) return "active"
    if (cachedPorts.includes(port)) return "cached"
    return "unloaded"
  }

  const handleWorkerDestroyed = (port: number) => {
    setRecentPorts((prev) => prev.filter((p) => p !== port))
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
              <div className="flex h-full items-center justify-center px-6 bg-[#282828]">
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
