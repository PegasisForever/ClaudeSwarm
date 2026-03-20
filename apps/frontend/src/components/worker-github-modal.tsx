import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react"
import { useEffect, useState, type Key } from "react"
import type { GlobalSettings, WorkerInfo } from "../lib/api-types"
import { trpc } from "../trpc"

type WorkerGithubModalProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  settings: GlobalSettings
  worker: WorkerInfo
}

export function WorkerGithubModal({
  isOpen,
  onOpenChange,
  settings,
  worker,
}: WorkerGithubModalProps) {
  const utils = trpc.useUtils()
  const [selection, setSelection] = useState<string>("default")

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setSelection(
      worker.usesDefaultGithubAccount ? "default" : (worker.githubAccountId ?? "default"),
    )
  }, [isOpen, worker.githubAccountId, worker.usesDefaultGithubAccount])

  const setWorkerGithubAccount = trpc.setWorkerGithubAccount.useMutation({
    onSuccess: async () => {
      await utils.workers.invalidate()
      onOpenChange(false)
    },
  })

  const handleSave = () => {
    setWorkerGithubAccount.mutate({
      accountId: selection === "default" ? undefined : selection,
      workerId: worker.id,
    })
  }

  return (
    <Modal
      backdrop="blur"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="top-center"
      size="lg"
    >
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader>Worker GitHub Account</ModalHeader>
            <ModalBody className="gap-4">
              <p className="text-default-500 text-sm">
                Select which saved GitHub account this worker should use.
              </p>
              <Select
                label="GitHub Account"
                onSelectionChange={(keys) => {
                  const nextKey =
                    keys === "all"
                      ? undefined
                      : (Array.from(keys)[0] as Key | undefined)

                  if (typeof nextKey === "string") {
                    setSelection(nextKey)
                  }
                }}
                selectedKeys={[selection]}
              >
                <SelectItem key="default" textValue="Follow default">
                  Follow default
                </SelectItem>
                {settings.githubAccounts.map((account) => (
                  <SelectItem
                    key={account.id}
                    textValue={`${account.name} (@${account.username})`}
                  >
                    {account.name} (@{account.username})
                  </SelectItem>
                ))}
              </Select>

              <p className="text-default-400 text-xs">
                Running workers are updated immediately. Stopped workers will use the selected account the next time they start.
              </p>

              {setWorkerGithubAccount.error ? (
                <p className="text-danger text-sm">
                  {setWorkerGithubAccount.error.message}
                </p>
              ) : null}
            </ModalBody>
            <ModalFooter>
              <Button onPress={close} variant="light">
                Cancel
              </Button>
              <Button
                color="primary"
                isLoading={setWorkerGithubAccount.isPending}
                onPress={handleSave}
                variant="flat"
              >
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
