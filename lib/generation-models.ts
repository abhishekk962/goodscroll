import "server-only"
import { getConnectionSettings } from "@/lib/browser-settings"
import {
  connectionClient,
  getOpenCodeDirectory,
  getOpenCodeSelection,
  type OpenCodeModel,
} from "@/lib/opencode"
import { isTextGenerationModel } from "@/lib/generation-types"

export async function getGenerationModels(
  projectID?: string
): Promise<OpenCodeModel[]> {
  const { project } = await getOpenCodeSelection(projectID)
  if (!project) return []
  const client = connectionClient(
    await getConnectionSettings(),
    await getOpenCodeDirectory(project)
  )
  const { data } = await client.provider.list({ throwOnError: true })
  return (data?.all ?? [])
    .filter((provider) => data?.connected.includes(provider.id))
    .flatMap((provider) =>
      Object.values(provider.models)
        .filter(isTextGenerationModel)
        .map((model) => ({
          id: `${provider.id}/${model.id}`,
          name: model.name ?? model.id,
          provider: provider.name ?? provider.id,
        }))
    )
    .sort(
      (a, b) =>
        a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name)
    )
}
