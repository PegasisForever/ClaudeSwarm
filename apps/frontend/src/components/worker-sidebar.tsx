import { Button } from "@heroui/react"
import { IconPlus } from "@tabler/icons-react"
import { useState } from "react"
import { Link, useParams } from "react-router"
import type { PresetInfo, WorkerInfo } from "../lib/api-types"
import { formatDuration, statusTone } from "../lib/format"
import { AddWorkerModal } from "./add-worker-modal"

type WorkerSidebarProps = {
  presets: PresetInfo[]
  workers: WorkerInfo[]
}

function WorkerItem({ worker }: { worker: WorkerInfo }) {
  const { id } = useParams<{ id: string }>()
  const isActive = id === worker.id

  return (
    <Button
      as={Link}
      className={`relative h-auto w-full flex-col items-start gap-0 rounded-none px-4 py-3 text-left ${
        isActive ? "bg-gray-700" : ""
      }`}
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
      </p>
      <p className="mt-2 text-base text-wrap">{worker.title}</p>
      {worker.pr ? (
        <a
          className="mt-1 font-mono underline underline-offset-4 text-gray-300"
          href={worker.pr.link}
          rel="noreferrer"
          target="_blank"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {worker.pr.baseBranch} ← #{worker.pr.number}
        </a>
      ) : null}
    </Button>
  )
}

export function WorkerSidebar({ presets, workers }: WorkerSidebarProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  return (
    <>
      <aside className="h-screen w-[20rem] shrink-0 bg-[#282828] p-3">
        <div className="h-full rounded-lg bg-[#353535]">
          <div className="flex items-center justify-between px-4 py-4">
            <h1 className="text-default-600 text-xs font-semibold tracking-[0.4em] uppercase">
              ClaudeSwarm
            </h1>
            <Button
              isIconOnly
              onPress={() => setIsAddModalOpen(true)}
              size="sm"
              variant="light"
            >
              <IconPlus size={18} />
            </Button>
          </div>
          {workers.length > 0 ? (
            <div className="flex flex-col">
              {workers.map((worker) => (
                <WorkerItem
                  key={worker.id}
                  worker={worker}
                />
              ))}
            </div>
          ) : null}
        </div>
      </aside>

      <AddWorkerModal
        isOpen={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        presets={presets}
      />
    </>
  )
}
