import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { WorkerSidebar } from "../components/worker-sidebar"
import { WorkerWorkspace } from "../components/worker-workspace"
import type { WorkerInfo } from "../lib/api-types"
import { trpc } from "../trpc"

const MAX_CACHED_WORKSPACES = 6

const WORKING_TO_NOTIFY: readonly string[] = ["idle", "waiting", "error"]

function showWorkerTransitionNotification(
  worker: WorkerInfo,
  newStatus: string,
  onNavigate: (port: number) => void,
) {
  if (!("Notification" in window) || Notification.permission !== "granted") return

  const n = new Notification("Worker finished", {
    body: `${worker.title} (${worker.preset}) is now ${newStatus}`,
    tag: `worker-${worker.port}`,
  })

  n.onclick = () => {
    window.focus()
    n.close()
    onNavigate(worker.port)
  }
}

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
  const destroyWorker = trpc.destroyWorker.useMutation()
  const [recentPorts, setRecentPorts] = useState<number[]>([])
  const [prevActivePort, setPrevActivePort] = useState<number | undefined>()
  const prevStatusByPort = useRef<Map<number, string>>(new Map())

  useEffect(() => {
    if (!("Notification" in window)) return
    if (Notification.permission === "default") {
      void Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    const workers = workersQuery.data ?? []
    const prev = prevStatusByPort.current

    for (const worker of workers) {
      const prevStatus = prev.get(worker.port)
      prev.set(worker.port, worker.status)

      if (
        prevStatus === "working" &&
        WORKING_TO_NOTIFY.includes(worker.status)
      ) {
        showWorkerTransitionNotification(worker, worker.status, (port) => {
          void navigate(`/${port}`)
        })
      }
    }

    for (const port of prev.keys()) {
      if (!workers.some((w) => w.port === port)) {
        prev.delete(port)
      }
    }
  }, [workersQuery.data, navigate])

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

  const handleDestroyWorker = async (port: number) => {
    await destroyWorker.mutateAsync({ port })
    await workersQuery.refetch()

    setRecentPorts((prev) => prev.filter((p) => p !== port))
    void navigate("/")
  }

  return (
    <>
      <div className="bg-background text-foreground flex min-h-screen">
        <WorkerSidebar presets={presets} workers={workers} />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {activePort && availablePorts.has(activePort) ? (
              workers.map((worker) => (
                <WorkerWorkspace
                  key={worker.port}
                  onDestroyWorker={handleDestroyWorker}
                  state={getWorkerState(worker.port)}
                  worker={worker}
                />
              ))
            ) : (
              <div className="flex h-full items-center justify-center bg-[#282828] px-6">
                <div className="max-w-lg text-center">
                  <p className="text-default-500 text-xs tracking-[0.26em] uppercase">
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
