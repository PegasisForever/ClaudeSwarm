import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react"
import { IconCode, IconTerminal2, IconTrash } from "@tabler/icons-react"
import { useAtom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react"
import type { WorkerInfo } from "../lib/api-types"
import {
  getTerminalSelectionKey,
  readStoredString,
  writeStoredString,
} from "../lib/storage"
import { trpc } from "../trpc"
import { TerminalSession } from "./terminal-session"
import { getWorkerIframeUrl } from "../lib/worker-urls"

const DEFAULT_TERMINAL_HEIGHT = 320
const terminalHeightAtom = atomWithStorage(
  "terminal-height",
  DEFAULT_TERMINAL_HEIGHT,
)

type WorkerWorkspaceState = "active" | "cached" | "unloaded"

type WorkerWorkspaceProps = {
  onWorkerDestroyed: (port: number) => void
  state: WorkerWorkspaceState
  worker: WorkerInfo
}

type TerminalName = "claude" | "terminal"

const terminalSessions: Array<{
  command: string
  label: string
  value: TerminalName
}> = [
  {
    command: "tmux new-session -A -s claude",
    label: "claude",
    value: "claude",
  },
  {
    command: "tmux new-session -A -s terminal",
    label: "terminal",
    value: "terminal",
  },
]

const MIN_TERMINAL_HEIGHT = 200
const MIN_VIEWPORT_HEIGHT = 220

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

const terminalIcons: Record<TerminalName, typeof IconCode> = {
  claude: IconCode,
  terminal: IconTerminal2,
}

export function WorkerWorkspace({
  onWorkerDestroyed,
  state,
  worker,
}: WorkerWorkspaceProps) {
  const { port: workerPort } = worker
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [terminalHeight, setTerminalHeight] = useAtom(terminalHeightAtom)
  const [destroyModalOpen, setDestroyModalOpen] = useState(false)
  const [activeTerminal, setActiveTerminal] = useState<TerminalName>(() => {
    const storedTerminal = readStoredString(getTerminalSelectionKey(workerPort))
    return storedTerminal === "terminal" ? "terminal" : "claude"
  })

  const utils = trpc.useUtils()
  const destroyWorker = trpc.destroyWorker.useMutation({
    onSuccess: async () => {
      setDestroyModalOpen(false)
      onWorkerDestroyed(workerPort)
      await utils.workers.invalidate()
    },
  })

  useEffect(() => {
    writeStoredString(getTerminalSelectionKey(workerPort), activeTerminal)
  }, [activeTerminal, workerPort])

  const beginResize = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const shell = shellRef.current

    if (!shell) {
      return
    }

    event.preventDefault()

    const startHeight = terminalHeight
    const startY = event.clientY
    const shellRect = shell.getBoundingClientRect()
    const maximumHeight = Math.max(
      MIN_TERMINAL_HEIGHT,
      shellRect.height - MIN_VIEWPORT_HEIGHT,
    )

    const handlePointerMove = (moveEvent: globalThis.MouseEvent) => {
      const delta = startY - moveEvent.clientY
      setTerminalHeight(
        clamp(startHeight + delta, MIN_TERMINAL_HEIGHT, maximumHeight),
      )
    }

    const stopResize = () => {
      window.removeEventListener("mousemove", handlePointerMove)
      window.removeEventListener("mouseup", stopResize)
    }

    window.addEventListener("mousemove", handlePointerMove)
    window.addEventListener("mouseup", stopResize)
  }

  if (state === "unloaded") {
    return null
  }

  const hiddenClass =
    state === "active"
      ? "pointer-events-auto opacity-100"
      : "pointer-events-none opacity-0"

  return (
    <>
      <Modal
        backdrop="blur"
        isOpen={destroyModalOpen}
        onOpenChange={setDestroyModalOpen}
        placement="top-center"
      >
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>Destroy Worker</ModalHeader>
              <ModalBody>
                <p className="text-default-500">
                  Destroy &quot;{worker.title}&quot; on port {worker.port}?
                </p>
              </ModalBody>
              <ModalFooter className="pt-3">
                <Button onPress={close} variant="light">
                  Cancel
                </Button>
                <Button
                  color="danger"
                  isLoading={destroyWorker.isPending}
                  onPress={() => destroyWorker.mutate({ port: workerPort })}
                  variant="flat"
                >
                  Destroy
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <section
        className={`absolute inset-0 flex flex-col ${hiddenClass}`}
        ref={shellRef}
      >
      <iframe
        allow="clipboard-read; clipboard-write"
        className="h-full w-full border-0 bg-[#282828]"
        src={getWorkerIframeUrl(workerPort)}
      />

      <div className="shrink-0">
        <button
          aria-label="Resize terminal area"
          className="text-default-500 hover:text-default-300 flex h-6 w-full items-center justify-center transition"
          onMouseDown={beginResize}
          type="button"
        >
          <span className="bg-divider h-px w-full" />
          <span className="bg-default-500 text-background absolute rounded-full px-2 py-1 text-[10px] tracking-[0.2em] uppercase">
            drag
          </span>
        </button>
      </div>

      <div
        className="relative flex shrink-0 overflow-hidden"
        style={{ height: `${terminalHeight}px` }}
      >
        <div className=" bg-[#282828] p-3 pl-0">
          <div className="h-full flex flex-col items-center justify-between bg-[#353535] rounded-lg p-1">
            <div className="flex flex-col items-center gap-1">
              {terminalSessions.map((session) => {
                const isSelected = activeTerminal === session.value
                const Icon = terminalIcons[session.value]

                return (
                  <Button
                    className={isSelected ? "text-primary" : "text-default-500"}
                    isIconOnly
                    key={session.value}
                    onPress={() => setActiveTerminal(session.value)}
                    size="sm"
                    variant="light"
                  >
                    <Icon size={18} />
                  </Button>
                )
              })}
            </div>
            <Button
              className="text-default-500"
              color="danger"
              isIconOnly
              onPress={() => setDestroyModalOpen(true)}
              size="sm"
              variant="light"
            >
              <IconTrash size={18} />
            </Button>
          </div>
        </div>
        <div className="relative min-w-0 flex-1">
          {terminalSessions.map((session) => (
            <TerminalSession
              command={session.command}
              isActive={activeTerminal === session.value}
              key={session.value}
              port={workerPort}
              title={session.label}
            />
          ))}
        </div>
      </div>
    </section>
    </>
  )
}
