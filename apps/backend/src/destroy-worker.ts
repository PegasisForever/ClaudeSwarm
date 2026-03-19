import { docker, findManagedContainerById, WORKER_WORKSPACE_VOLUME_LABEL } from "./worker-container"
import { clearWorkersCache } from "./list-workers"
import { clearWorkerGithubAccount } from "./secrets"

export async function destroyWorkerContainer(
  id: string,
  options?: { removeWorkspaceVolume?: boolean },
) {
  const container = await findManagedContainerById(id)

  if (!container) {
    throw new Error(`No managed worker found for id ${id}`)
  }

  const inspection = await container.inspect()
  const workspaceVolumeName =
    inspection.Config.Labels?.[WORKER_WORKSPACE_VOLUME_LABEL]

  await container.remove({ force: true })

  if (options?.removeWorkspaceVolume !== false && workspaceVolumeName) {
    try {
      await docker.getVolume(workspaceVolumeName).remove()
    } catch (error) {
      console.error("[destroyWorker] failed to remove workspace volume", error)
    }
  }

  clearWorkerGithubAccount(id)
  clearWorkersCache()
}
