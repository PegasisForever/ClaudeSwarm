import {
  Button,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react"
import { useMemo, useState, type Key } from "react"
import { useNavigate } from "react-router"
import type { PresetInfo } from "../lib/api-types"
import { trpc } from "../trpc"

type AddWorkerModalProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  presets: PresetInfo[]
}

export function AddWorkerModal({
  isOpen,
  onOpenChange,
  presets,
}: AddWorkerModalProps) {
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const [title, setTitle] = useState("")
  const [presetName, setPresetName] = useState("")
  const [envValues, setEnvValues] = useState<Record<string, string>>({})

  const startWorker = trpc.startWorker.useMutation({
    onSuccess: async ({ port }) => {
      onOpenChange(false)
      await utils.workers.invalidate()
      navigate(`/${port}`)
    },
  })

  const effectivePresetName = presetName || presets[0]?.name || ""
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.name === effectivePresetName),
    [effectivePresetName, presets],
  )

  const missingRequiredField =
    title.trim().length === 0 ||
    (selectedPreset?.requiredEnv.some(
      (key) => (envValues[key] ?? "").trim().length === 0,
    ) ??
      true)

  const errorMessage = startWorker.error?.message

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTitle("")
      setPresetName("")
      setEnvValues({})
      startWorker.reset()
    }

    onOpenChange(open)
  }

  return (
    <Modal
      backdrop="blur"
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      placement="top-center"
      size="2xl"
    >
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader className="flex flex-col gap-1 pb-3">
              <p className="text-default-500 text-xs tracking-[0.24em] uppercase">
                Start worker
              </p>
              <p className="text-foreground text-2xl font-semibold">
                Create a new worker from a preset
              </p>
            </ModalHeader>
            <Divider />
            <ModalBody className="gap-5 py-5">
              <Input
                autoFocus
                classNames={{
                  inputWrapper:
                    "bg-transparent shadow-none ring-1 ring-white/10 data-[hover=true]:bg-transparent",
                }}
                isRequired
                label="Worker title"
                onValueChange={setTitle}
                placeholder="Frontend QA, bug triage, release check..."
                value={title}
              />
              <Select
                classNames={{
                  trigger:
                    "bg-transparent shadow-none ring-1 ring-white/10 data-[hover=true]:bg-transparent",
                }}
                disallowEmptySelection
                label="Preset"
                onSelectionChange={(keys) => {
                  const nextKey =
                    keys === "all"
                      ? undefined
                      : (Array.from(keys)[0] as Key | undefined)

                  if (typeof nextKey === "string") {
                    setPresetName(nextKey)
                  }
                }}
                selectedKeys={effectivePresetName ? [effectivePresetName] : []}
              >
                {presets.map((preset) => (
                  <SelectItem key={preset.name}>{preset.name}</SelectItem>
                ))}
              </Select>

              {presets.length === 0 ? (
                <p className="text-default-400 text-sm">
                  No presets are currently available from the backend.
                </p>
              ) : null}

              {selectedPreset ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-default-500 text-xs tracking-[0.22em] uppercase">
                      Required environment
                    </p>
                    <p className="text-default-400 text-sm">
                      These fields come directly from the selected preset.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedPreset.requiredEnv.map((envKey) => (
                      <Input
                        classNames={{
                          inputWrapper:
                            "bg-transparent shadow-none ring-1 ring-white/10 data-[hover=true]:bg-transparent",
                        }}
                        isRequired
                        key={envKey}
                        label={envKey}
                        onValueChange={(value) =>
                          setEnvValues((currentValues) => ({
                            ...currentValues,
                            [envKey]: value,
                          }))
                        }
                        type={"text"}
                        value={envValues[envKey] ?? ""}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <p className="text-danger text-sm">{errorMessage}</p>
              ) : null}
            </ModalBody>
            <Divider />
            <ModalFooter className="pt-3">
              <Button onPress={close} variant="light">
                Cancel
              </Button>
              <Button
                color="secondary"
                isDisabled={missingRequiredField}
                isLoading={startWorker.isPending}
                onPress={() => {
                  if (!selectedPreset) {
                    return
                  }

                  startWorker.mutate({
                    env: envValues,
                    preset: selectedPreset.name,
                    title: title.trim(),
                  })
                }}
                variant="flat"
              >
                Start worker
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
