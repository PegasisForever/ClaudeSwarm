import { XTerm } from "@pablo-lion/xterm-react"
import { FitAddon } from "@xterm/addon-fit"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import { getWorkerTerminalUrl } from "../lib/worker-urls"

type TerminalSessionProps = {
  command: string
  isActive: boolean
  onPasteFiles?: (files: File[]) => Promise<void>
  port: number
  title: string
}

type TerminalMessage =
  | { type: "output"; data: string }
  | { type: "exit"; exitCode: number }

export type TerminalSessionHandle = {
  sendInput: (data: string) => void
}

function getClipboardFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) {
    return []
  }

  if (clipboardData.files.length > 0) {
    return Array.from(clipboardData.files)
  }

  return Array.from(clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
}

const terminalTheme = {
  background: "#282828",
  foreground: "#f8f8f2",
  cursor: "#f8f8f2",
  cursorAccent: "#282a36",
  selectionBackground: "#44475a",
  black: "#21222c",
  red: "#ff5555",
  green: "#50fa7b",
  yellow: "#f1fa8c",
  blue: "#bd93f9",
  magenta: "#ff79c6",
  cyan: "#8be9fd",
  white: "#f8f8f2",
  brightBlack: "#6272a4",
  brightRed: "#ff6e6e",
  brightGreen: "#69ff94",
  brightYellow: "#ffffa5",
  brightBlue: "#d6acff",
  brightMagenta: "#ff92df",
  brightCyan: "#a4ffff",
  brightWhite: "#ffffff",
} as const

const terminalOptions = {
  allowProposedApi: false,
  convertEol: true,
  cursorBlink: true,
  fontFamily:
    '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, monospace',
  fontSize: 14,
  lineHeight: 1.1,
  theme: terminalTheme,
} as const

export const TerminalSession = forwardRef<TerminalSessionHandle, TerminalSessionProps>(function TerminalSession({
  command,
  isActive,
  onPasteFiles,
  port,
}: TerminalSessionProps, ref) {
  const xtermRef = useRef<InstanceType<typeof XTerm> | null>(null)
  const fitAddon = useMemo(() => new FitAddon(), [])
  const socketRef = useRef<WebSocket | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pendingInputRef = useRef<string[]>([])

  const safeFit = useCallback(() => {
    try {
      fitAddon.fit()
    } catch {
      // fit() throws when the terminal element has zero dimensions (e.g. display:none)
    }
  }, [fitAddon])

  const terminalUrl = useMemo(
    () => getWorkerTerminalUrl(port, command),
    [command, port],
  )

  const sendInput = useCallback((data: string) => {
    const socket = socketRef.current

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ data, type: "input" }))
      return
    }

    pendingInputRef.current.push(data)
  }, [])

  const flushPendingInput = useCallback(() => {
    const socket = socketRef.current

    if (socket?.readyState !== WebSocket.OPEN) {
      return
    }

    for (const data of pendingInputRef.current) {
      socket.send(JSON.stringify({ data, type: "input" }))
    }

    pendingInputRef.current = []
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      sendInput,
    }),
    [sendInput],
  )

  useEffect(() => {
    const socket = new WebSocket(terminalUrl)
    socketRef.current = socket

    const sendResize = () => {
      const xterm = xtermRef.current
      if (socket.readyState !== WebSocket.OPEN || !xterm?.terminal) return

      safeFit()
      const { cols, rows } = xterm.terminal
      socket.send(JSON.stringify({ cols, rows, type: "resize" }))
    }

    socket.addEventListener("open", () => {
      requestAnimationFrame(sendResize)
      flushPendingInput()
    })

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as TerminalMessage

        if (message.type === "output") {
          xtermRef.current?.write(message.data)
          return
        }

        if (message.type === "exit") {
          xtermRef.current?.writeln(
            `\r\n\u001b[31m[session exited with code ${message.exitCode}]\u001b[0m`,
          )
        }
      } catch {
        xtermRef.current?.writeln(
          "\r\n\u001b[31m[invalid terminal message]\u001b[0m",
        )
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      sendResize()
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    requestAnimationFrame(() => {
      safeFit()
      sendResize()
    })

    return () => {
      resizeObserver.disconnect()
      socket.close()
      socketRef.current = null
    }
  }, [terminalUrl, fitAddon, safeFit, flushPendingInput])

  useEffect(() => {
    requestAnimationFrame(() => {
      safeFit()

      const socket = socketRef.current
      const xterm = xtermRef.current

      if (!xterm?.terminal || socket?.readyState !== WebSocket.OPEN) return

      const { cols, rows } = xterm.terminal
      socket.send(JSON.stringify({ cols, rows, type: "resize" }))
    })
  }, [safeFit])

  useEffect(() => {
    if (!isActive) return
    requestAnimationFrame(() => {
      xtermRef.current?.focus()
    })
  }, [isActive])

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const files = getClipboardFiles(event.clipboardData)

      if (!isActive || files.length === 0 || !onPasteFiles) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void onPasteFiles(files)
    }

    document.addEventListener("paste", handlePaste, true)

    return () => {
      document.removeEventListener("paste", handlePaste, true)
    }
  }, [isActive, onPasteFiles])

  const handleCustomKeyEvent = useCallback((event: KeyboardEvent) => {
    const isPasteShortcut =
      event.type === "keydown" &&
      event.key.toLowerCase() === "v" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey

    if (!isPasteShortcut) {
      return true
    }

    return false
  }, [])

  const handleData = (data: string) => {
    sendInput(data)
  }

  const handleSelectionChange = () => {
    const selection = xtermRef.current?.getSelection()
    if (selection) {
      void navigator.clipboard.writeText(selection)
    }
  }

  return (
    <div className={isActive ? "absolute inset-0 pointer-events-auto opacity-100" : "absolute inset-0 pointer-events-none opacity-0"}>
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden bg-[#282828] pt-2"
      >
        <XTerm
          ref={xtermRef}
          className="h-full w-full"
          options={terminalOptions}
          addons={[fitAddon]}
          customKeyEventHandler={handleCustomKeyEvent}
          onData={handleData}
          onSelectionChange={handleSelectionChange}
        />
      </div>
    </div>
  )
})
