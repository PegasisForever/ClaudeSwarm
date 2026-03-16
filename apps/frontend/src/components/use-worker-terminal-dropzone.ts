import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"

const WORKER_UPLOADS_DIRECTORY = "/home/kasm-user/Uploads"
const WORKER_UPLOADS_SHELL_DIRECTORY = "~/Uploads"

function quoteShellPath(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

function getWorkerUploadUrl(port: number): string {
  const url = new URL(window.location.href)
  url.port = `${port}`
  url.pathname = "/monitor/upload"
  url.hash = ""
  url.search = ""
  return url.toString()
}

async function readUploadError(response: Response) {
  try {
    const data = (await response.json()) as { error?: unknown }

    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error
    }
  } catch {
    // fall back to the response status when the body is not JSON
  }

  return response.statusText || "Failed to upload file"
}

type UseWorkerTerminalDropzoneOptions<TTerminalName extends string> = {
  activeTerminal: TTerminalName
  disabled: boolean
  onUploadPathReady: (paths: string[], terminal: TTerminalName) => void
  workerPort: number
}

export function useWorkerTerminalDropzone<TTerminalName extends string>({
  activeTerminal,
  disabled,
  onUploadPathReady,
  workerPort,
}: UseWorkerTerminalDropzoneOptions<TTerminalName>) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(
    null,
  )
  const clearUploadError = useCallback(() => {
    setUploadError(null)
  }, [])

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return
      }

      setUploadError(null)
      setIsUploading(true)

      try {
        const typedPaths: string[] = []

        for (const file of files) {
          const uploadPath = `${WORKER_UPLOADS_DIRECTORY}/${file.name}`
          const typedPath = quoteShellPath(
            `${WORKER_UPLOADS_SHELL_DIRECTORY}/${file.name}`,
          )
          const formData = new FormData()

          formData.set("path", uploadPath)
          formData.set("file", file, file.name)
          setUploadingFileName(file.name)

          const response = await fetch(getWorkerUploadUrl(workerPort), {
            body: formData,
            method: "POST",
          })

          if (!response.ok) {
            throw new Error(await readUploadError(response))
          }

          typedPaths.push(typedPath)
        }

        onUploadPathReady(typedPaths, activeTerminal)
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : "Failed to upload file",
        )
      } finally {
        setIsUploading(false)
        setUploadingFileName(null)
      }
    },
    [activeTerminal, onUploadPathReady, workerPort],
  )

  const dropzone = useDropzone({
    disabled: disabled || isUploading,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    onDropAccepted(files) {
      if (files.length === 0) {
        return
      }

      void uploadFiles(files)
    },
    onDropRejected(fileRejections) {
      const errorMessage =
        fileRejections[0]?.errors[0]?.message ?? "Failed to accept dropped file"
      setUploadError(errorMessage)
    },
  })

  return {
    clearUploadError,
    getInputProps: dropzone.getInputProps,
    getRootProps: dropzone.getRootProps,
    isUploading,
    showDropOverlay: !disabled && (dropzone.isDragActive || isUploading),
    uploadError,
    uploadFiles,
    uploadingFileName,
  }
}
