import { validOrigin } from "@/lib/browser-settings"
import { getGenerationModels } from "@/lib/generation-models"
import {
  DEFAULT_GENERATION_SETTINGS,
  type GenerationSettings,
} from "@/lib/generation-types"
import {
  getGenerationSettings,
  saveGenerationSettings,
} from "@/lib/local-database"

export const runtime = "nodejs"
export function GET() {
  return Response.json(getGenerationSettings(), {
    headers: { "Cache-Control": "no-store" },
  })
}
export async function PUT(request: Request) {
  if (!validOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 })
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: "Invalid generation settings." },
      { status: 400 }
    )
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json(
      { error: "Invalid generation settings." },
      { status: 400 }
    )
  const value = body.reset === true ? { ...DEFAULT_GENERATION_SETTINGS } : body
  if (
    (value.model !== null &&
      (typeof value.model !== "string" ||
        value.model.length > 200 ||
        !value.model.includes("/"))) ||
    typeof value.enabled !== "boolean" ||
    typeof value.useFeedback !== "boolean" ||
    !Number.isInteger(value.sourceLimit) ||
    value.sourceLimit < 1 ||
    value.sourceLimit > 12 ||
    !["beginner", "balanced", "advanced"].includes(value.depth)
  )
    return Response.json(
      { error: "Choose valid settings and 1–12 source conversations." },
      { status: 400 }
    )
  // Allow pausing or adjusting preferences when a previously saved model is offline.
  if (value.model !== null && value.model !== getGenerationSettings().model) {
    try {
      const models = await getGenerationModels(
        new URL(request.url).searchParams.get("project") ?? undefined
      )
      if (!models.some((model) => model.id === value.model))
        return Response.json(
          { error: "Choose an available text-generation model." },
          { status: 400 }
        )
    } catch {
      return Response.json(
        { error: "Could not load models. Check the OpenCode connection." },
        { status: 502 }
      )
    }
  }
  const settings: GenerationSettings = {
    model: value.model,
    enabled: value.enabled,
    sourceLimit: value.sourceLimit,
    useFeedback: value.useFeedback,
    depth: value.depth,
  }
  saveGenerationSettings(settings)
  return Response.json({
    settings,
    message:
      "Generation settings saved for all projects. Changes apply to the next run.",
  })
}
