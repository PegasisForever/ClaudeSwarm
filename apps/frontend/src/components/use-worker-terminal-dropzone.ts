import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { getWorkerUploadUrl } from "../lib/worker-urls"

const WORKER_UPLOADS_DIRECTORY = "/home/kasm-user/Uploads"

type UploadableFile = File & {
  path?: string
}

type UploadResponse = {
  actualPath?: unknown
  error?: unknown
  path?: unknown
}

function quoteShellPath(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

function normalizeRelativePath(value: string) {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .join("/")
}

function isAbsoluteClientPath(value: string) {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)
}

function getPreferredUploadPath(file: UploadableFile) {
  const relativePath =
    file.webkitRelativePath ||
    (file.path && !isAbsoluteClientPath(file.path) ? file.path : "") ||
    file.name

  const normalizedRelativePath = normalizeRelativePath(relativePath)
  return `${WORKER_UPLOADS_DIRECTORY}/${normalizedRelativePath || file.name}`
}

async function readUploadError(response: Response) {
  try {
    const data = (await response.json()) as UploadResponse

    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error
    }
  } catch {
    // fall back to the response status when the body is not JSON
  }

  return response.statusText || "Failed to upload file"
}

async function readUploadedPath(response: Response) {
  const data = (await response.json()) as UploadResponse

  if (typeof data.actualPath === "string" && data.actualPath.length > 0) {
    return data.actualPath
  }

  if (typeof data.path === "string" && data.path.length > 0) {
    return data.path
  }

  throw new Error("Upload succeeded but the saved path was missing")
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
          const preferredPath = getPreferredUploadPath(file as UploadableFile)
          const formData = new FormData()

          formData.set("path", preferredPath)
          formData.set("file", file, file.name)
          setUploadingFileName(file.name)

          const response = await fetch(getWorkerUploadUrl(workerPort), {
            body: formData,
            method: "POST",
          })

          if (!response.ok) {
            throw new Error(await readUploadError(response))
          }

          typedPaths.push(quoteShellPath(await readUploadedPath(response)))
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
