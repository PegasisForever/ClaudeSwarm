import { Button } from "@heroui/react"
import { IconPlayerPause, IconPlayerPlay, IconPlus, IconSettings } from "@tabler/icons-react"
import { useState } from "react"
import { Link, useParams } from "react-router"
import type { GlobalSettings, PresetInfo, WorkerInfo } from "../lib/api-types"
import { formatDuration, statusTone } from "../lib/format"
import { AddWorkerModal } from "./add-worker-modal"
import { BrandLogo } from "./brand-logo"
import { GlobalSettingsModal } from "./global-settings-modal"

type WorkerSidebarProps = {
  globalSettings: GlobalSettings
  isStartingWorker: (id: string) => boolean
  isStoppingWorker: (id: string) => boolean
  onStartWorker: (id: string) => Promise<void>
  onStopWorker: (id: string) => Promise<void>
  presets: PresetInfo[]
  workers: WorkerInfo[]
  hierarchy: Record<string, string[]>
}

type WorkerListItemProps = {
  worker: WorkerInfo
  isStarting: boolean
  isStopping: boolean
  onStartWorker: (id: string) => Promise<void>
  onStopWorker: (id: string) => Promise<void>
}

function WorkerLifecycleButton({
  worker,
  isStarting,
  isStopping,
  onStartWorker,
  onStopWorker,
}: WorkerListItemProps) {
  const isStopped = worker.status === "stopped"

  return (
    <Button
      className="mt-3 shrink-0 self-start"
      color={isStopped ? "success" : "default"}
      isIconOnly
      isLoading={isStarting || isStopping}
      onPress={() =>
        void (isStopped ? onStartWorker(worker.id) : onStopWorker(worker.id))
      }
      size="sm"
      variant="light"
    >
      {isStopped ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
    </Button>
  )
}

function WorkerItem({
  worker,
  isStarting,
  isStopping,
  onStartWorker,
  onStopWorker,
}: WorkerListItemProps) {
  const { id } = useParams<{ id: string }>()
  const isActive = id === worker.id

  return (
    <div className={`flex items-start gap-1 pr-2 ${isActive ? "bg-gray-700" : ""}`}>
      <Button
        as={Link}
        className="relative h-auto flex-1 flex-col items-start gap-0 rounded-none px-4 py-3 text-left"
        to={`/${worker.id}`}
        variant="light"
        fullWidth
      >
        <p className="absolute top-3 right-4 text-sm text-gray-300">
          {formatDuration(worker.durationS)}
        </p>
        <p className="text-sm">
          <span
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${statusTone(worker.status)}`}
          />
          <span className="ml-2 text-gray-300">{worker.preset}</span>
          <span className="ml-2 text-gray-500 uppercase">{worker.status}</span>
        </p>
        <p className="mt-2 text-base text-wrap">{worker.title}</p>
      </Button>
      <WorkerLifecycleButton
        worker={worker}
        isStarting={isStarting}
        isStopping={isStopping}
        onStartWorker={onStartWorker}
        onStopWorker={onStopWorker}
      />
    </div>
  )
}

function SubWorkerItem({
  worker,
  isStarting,
  isStopping,
  onStartWorker,
  onStopWorker,
}: WorkerListItemProps) {
  const { id } = useParams<{ id: string }>()
  const isActive = id === worker.id

  return (
    <div className={`flex items-start gap-1 pr-2 ${isActive ? "bg-gray-700" : ""}`}>
      <Button
        as={Link}
        className="relative h-auto flex-1 flex-col items-start gap-0 rounded-none pl-8 pr-4 py-2 text-left"
        to={`/${worker.id}`}
        variant="light"
        fullWidth
      >
        <p className="absolute top-2 right-4 text-xs text-gray-300">
          {formatDuration(worker.durationS)}
        </p>
        <p className="text-xs">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusTone(worker.status)}`}
          />
          <span className="ml-2 text-gray-300">{worker.preset}</span>
          <span className="ml-2 text-gray-500 uppercase">{worker.status}</span>
        </p>
        <p className="mt-1 text-sm text-wrap">{worker.title}</p>
      </Button>
      <WorkerLifecycleButton
        worker={worker}
        isStarting={isStarting}
        isStopping={isStopping}
        onStartWorker={onStartWorker}
        onStopWorker={onStopWorker}
      />
    </div>
  )
}

export function WorkerSidebar({
  globalSettings,
  isStartingWorker,
  isStoppingWorker,
  onStartWorker,
  onStopWorker,
  presets,
  workers,
  hierarchy,
}: WorkerSidebarProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  const workerById = new Map(workers.map((w) => [w.id, w]))
  const childIds = new Set(Object.values(hierarchy).flat())
  const topLevelWorkers = workers.filter((w) => !childIds.has(w.id))

  return (
    <>
      <aside className="h-screen w-[20rem] shrink-0 bg-[#282828] p-3">
        <div className="h-full rounded-lg bg-[#353535]">
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <BrandLogo compact />
            <div className="flex items-center gap-1">
              <div className="relative">
                <Button
                  isIconOnly
                  onPress={() => setIsSettingsModalOpen(true)}
                  size="sm"
                  variant="light"
                >
                  <IconSettings size={18} />
                </Button>
                {globalSettings.githubTokenConfigured ? (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400" />
                ) : null}
              </div>
              <Button
                isIconOnly
                onPress={() => setIsAddModalOpen(true)}
                size="sm"
                variant="light"
              >
                <IconPlus size={18} />
              </Button>
            </div>
          </div>
          {topLevelWorkers.length > 0 ? (
            <div className="flex flex-col">
              {topLevelWorkers.map((worker) => {
                const children = (hierarchy[worker.id] ?? [])
                  .map((childId) => workerById.get(childId))
                  .filter((w): w is WorkerInfo => w !== undefined)

                return (
                  <div key={worker.id}>
                    <WorkerItem
                      isStarting={isStartingWorker(worker.id)}
                      isStopping={isStoppingWorker(worker.id)}
                      onStartWorker={onStartWorker}
                      onStopWorker={onStopWorker}
                      worker={worker}
                    />
                    {children.map((child) => (
                      <SubWorkerItem
                        key={child.id}
                        isStarting={isStartingWorker(child.id)}
                        isStopping={isStoppingWorker(child.id)}
                        onStartWorker={onStartWorker}
                        onStopWorker={onStopWorker}
                        worker={child}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </aside>

      <AddWorkerModal
        isOpen={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        presets={presets}
      />
      <GlobalSettingsModal
        isOpen={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
        settings={globalSettings}
      />
    </>
  )
}
