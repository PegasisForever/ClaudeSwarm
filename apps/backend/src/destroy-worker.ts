import { clearWorkersCache } from "./list-workers"
import { findManagedContainerByPort } from "./worker-container"

export async function destroyWorkerContainer(port: number) {
  const container = await findManagedContainerByPort(port)

  if (!container) {
    throw new Error(`No managed worker found for port ${port}`)
  }

  await container.remove({ force: true })
  clearWorkersCache()
}
