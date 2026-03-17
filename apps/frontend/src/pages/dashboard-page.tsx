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
  onNavigate: (id: string) => void,
) {
  if (!("Notification" in window) || Notification.permission !== "granted") return

  const n = new Notification("Worker finished", {
    body: `${worker.title} (${worker.preset}) is now ${newStatus}`,
    tag: `worker-${worker.id}`,
  })

  n.onclick = () => {
    window.focus()
    n.close()
    onNavigate(worker.id)
  }
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { id: activeId } = useParams<{ id: string }>()

  const workersQuery = trpc.workers.useQuery(undefined, {
    refetchInterval: 1_000,
    refetchOnWindowFocus: false,
  })
  const presetsQuery = trpc.presets.useQuery(undefined, {
    gcTime: Number.POSITIVE_INFINITY,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const destroyWorker = trpc.destroyWorker.useMutation()
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [prevActiveId, setPrevActiveId] = useState<string | undefined>()
  const prevStatusById = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!("Notification" in window)) return
    if (Notification.permission === "default") {
      void Notification.requestPermission()
    }
  }, [])

  const workers = workersQuery.data?.workers ?? []
  const hierarchy = workersQuery.data?.hierarchy ?? {}
  const presets = presetsQuery.data ?? []

  useEffect(() => {
    const prev = prevStatusById.current

    for (const worker of workers) {
      const prevStatus = prev.get(worker.id)
      prev.set(worker.id, worker.status)

      if (
        prevStatus === "working" &&
        WORKING_TO_NOTIFY.includes(worker.status)
      ) {
        showWorkerTransitionNotification(worker, worker.status, (id) => {
          void navigate(`/${id}`)
        })
      }
    }

    for (const id of prev.keys()) {
      if (!workers.some((w) => w.id === id)) {
        prev.delete(id)
      }
    }
  }, [workers, navigate])

  if (activeId !== undefined && activeId !== prevActiveId) {
    setPrevActiveId(activeId)
    setRecentIds((prev) =>
      [activeId, ...prev.filter((id) => id !== activeId)].slice(
        0,
        MAX_CACHED_WORKSPACES,
      ),
    )
  }

  const availableIds = new Set(workers.map((w) => w.id))

  const cachedIds = recentIds.filter((id) => availableIds.has(id))

  const getWorkerState = (id: string): "active" | "cached" | "unloaded" => {
    if (id === activeId) return "active"
    if (cachedIds.includes(id)) return "cached"
    return "unloaded"
  }

  const handleDestroyWorker = async (id: string) => {
    await destroyWorker.mutateAsync({ id })
    await workersQuery.refetch()

    setRecentIds((prev) => prev.filter((i) => i !== id))
    void navigate("/")
  }

  return (
    <>
      <div className="bg-background text-foreground flex min-h-screen">
        <WorkerSidebar
          presets={presets}
          workers={workers}
          hierarchy={hierarchy}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {activeId && availableIds.has(activeId) ? (
              workers.map((worker) => (
                <WorkerWorkspace
                  key={worker.id}
                  onDestroyWorker={handleDestroyWorker}
                  state={getWorkerState(worker.id)}
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
