import { Button, Divider, Spinner, Tooltip } from "@heroui/react"
import { IconPlus } from "@tabler/icons-react"
import type { WorkerInfo } from "../lib/api-types"
import { formatDuration, statusTone } from "../lib/format"

type WorkerSidebarProps = {
  destroyPendingPort?: number
  isLoading: boolean
  onCreateWorker: () => void
  onDestroyWorker: (worker: WorkerInfo) => void
  onRefresh: () => void
  onSelectWorker: (port: number) => void
  selectedPort?: number
  workers: WorkerInfo[]
}

export function WorkerSidebar({
  destroyPendingPort,
  isLoading,
  onCreateWorker,
  onDestroyWorker,
  onSelectWorker,
  selectedPort,
  workers,
}: WorkerSidebarProps) {
  const selectedWorker = workers.find((worker) => worker.port === selectedPort)

  return (
    <aside className="flex h-screen w-[20rem] shrink-0 flex-col bg-gray-800">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-xs font-semibold uppercase tracking-[0.3em] text-default-500">
          ClaudeSwarm
        </h1>
        <Tooltip content="New worker">
          <Button
            isIconOnly
            onPress={onCreateWorker}
            size="sm"
            variant="light"
          >
            <IconPlus size={18} />
          </Button>
        </Tooltip>
      </div>
      <Divider />
      {isLoading && workers.length === 0 ? (
        <div className="flex h-full items-center justify-center py-12">
          <Spinner color="secondary" size="sm" />
        </div>
      ) : null}

      {!isLoading && workers.length === 0 ? (
        <div className="px-3 py-12 text-center">
          <p className="text-default-500 text-sm tracking-[0.22em] uppercase">
            No workers
          </p>
          <p className="text-default-400 mt-3 text-sm">
            Start a new worker to open its preview and terminals.
          </p>
        </div>
      ) : null}

      {workers.length > 0 ? (
        <div className="divide-divider divide-y">
          {workers.map((worker) => {
            const isSelected = worker.port === selectedPort

            return (
              <button
                className={`w-full px-3 py-4 text-left transition ${
                  isSelected
                    ? "bg-primary/8 text-foreground"
                    : "text-default-500 hover:text-default-200 hover:bg-white/3"
                }`}
                key={`${worker.port}-${worker.title}`}
                onClick={() => onSelectWorker(worker.port)}
                type="button"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${statusTone(worker.status)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {worker.title}
                        </p>
                        <p className="text-default-500 mt-1 text-xs tracking-[0.18em] uppercase">
                          {worker.preset}
                        </p>
                      </div>
                      <p className="text-default-500 shrink-0 text-[11px] tracking-[0.18em] uppercase">
                        {formatDuration(worker.durationS)}
                      </p>
                    </div>

                    {worker.pr ? (
                      <div className="text-default-400 mt-3 space-y-1 text-xs">
                        <a
                          className="text-primary hover:text-primary-400 line-clamp-1"
                          href={worker.pr.link}
                          onClick={(event) => event.stopPropagation()}
                          rel="noreferrer"
                          target="_blank"
                        >
                          #{worker.pr.number} {worker.pr.name}
                        </a>
                        <p className="line-clamp-1">
                          {worker.pr.branch} → {worker.pr.baseBranch}
                        </p>
                      </div>
                    ) : (
                      <p className="text-default-500 mt-3 text-xs">
                        No PR metadata available.
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </aside>
  )
}
