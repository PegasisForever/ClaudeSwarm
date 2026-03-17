import { clearWorkersCache } from "./list-workers"
import { findManagedContainerById } from "./worker-container"

export async function destroyWorkerContainer(id: string) {
  const container = await findManagedContainerById(id)

  if (!container) {
    throw new Error(`No managed worker found for id ${id}`)
  }

  await container.remove({ force: true })
  clearWorkersCache()
}
