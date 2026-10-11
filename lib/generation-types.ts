import type { Topic } from "./content-types"

export type GenerationSettings = {
  model: string | null
  enabled: boolean
  sourceLimit: number
  useFeedback: boolean
  depth: "beginner" | "balanced" | "advanced"
}
export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  model: null,
  enabled: true,
  sourceLimit: 12,
  useFeedback: true,
  depth: "balanced",
}
export function isTextGenerationModel(model: {
  id: string
  tool_call?: boolean
  modalities?: { input: string[]; output: string[] }
  capabilities?: { input: { text: boolean }; output: { text: boolean } }
}) {
  if (model.capabilities)
    return model.capabilities.input.text && model.capabilities.output.text
  if (model.modalities)
    return (
      model.modalities.input.includes("text") &&
      model.modalities.output.includes("text")
    )
  return Boolean(
    model.tool_call && !/whisper|embed|transcri|tts/i.test(model.id)
  )
}
export type GenerationSource = {
  id: string
  title: string
  updatedAt: number
  messages: { role: string; text: string }[]
}
export type GenerationFeedback = {
  topicID: string
  title: string
  excerpt: string
  liked: boolean
  comments: string[]
}
export type GenerationInput = {
  topics: Topic[]
  requestedCounts: { post: number; reel: number }
  previous: { title: string; kind: string }[]
  feedback: GenerationFeedback[]
  preferences: { depth: GenerationSettings["depth"] }
  instruction: string
}
export type GenerationRunData = {
  settings: GenerationSettings
  sources: GenerationSource[]
  topicExtraction: boolean
  contentInput: GenerationInput | null
  generatedCounts: { post: number; reel: number } | null
}
export type GenerationRun = {
  id: string
  startedAt: number
  finishedAt: number | null
  status: "running" | "complete" | "failed" | "interrupted"
  stage: string
  model: string | null
  error: string | null
  data: GenerationRunData
}
