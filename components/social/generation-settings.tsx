"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowUpRight, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type GenerationSettings as Settings } from "@/lib/generation-types"
import type { OpenCodeModel } from "@/lib/opencode"

export function GenerationSettings({
  initial,
  models,
  projectID,
  modelError,
}: {
  initial: Settings
  models: OpenCodeModel[]
  projectID?: string
  modelError?: string
}) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{
    error: boolean
    text: string
  } | null>(null)
  const router = useRouter()
  const query = projectID ? `?project=${encodeURIComponent(projectID)}` : ""
  const selectClass = "h-11 w-full rounded-lg border bg-background px-3 text-sm"
  const unavailable =
    !!form.model && !models.some((model) => model.id === form.model)

  async function save(reset = false) {
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/generation-settings${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reset ? { reset: true } : form),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error ?? "Could not save generation settings.")
      setForm(data.settings)
      setFeedback({ error: false, text: data.message })
      router.refresh()
    } catch (cause) {
      setFeedback({
        error: true,
        text:
          cause instanceof Error
            ? cause.message
            : "Could not save generation settings.",
      })
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      className="space-y-4"
    >
      <fieldset disabled={busy} className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) =>
              setForm({ ...form, enabled: event.target.checked })
            }
            className="size-4 accent-primary"
          />
          Auto-generate content
        </label>
        <div className="space-y-2">
          <label htmlFor="generation-model" className="text-sm font-medium">
            Generation model
          </label>
          <select
            id="generation-model"
            value={form.model ?? ""}
            onChange={(event) =>
              setForm({ ...form, model: event.target.value || null })
            }
            className={selectClass}
          >
            <option value="">Automatic</option>
            {unavailable && (
              <option value={form.model!}>{form.model} (unavailable)</option>
            )}
            {[...new Set(models.map((model) => model.provider))].map(
              (provider) => (
                <optgroup key={provider} label={provider}>
                  {models
                    .filter((model) => model.provider === provider)
                    .map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                </optgroup>
              )
            )}
          </select>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Automatic uses a recent chat’s text model or a provider default.
          </p>
          {modelError && (
            <p role="alert" className="text-xs text-destructive">
              {modelError}
            </p>
          )}
          {unavailable && (
            <p className="text-xs text-destructive">
              Model unavailable. Choose Automatic or another model to generate.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="generation-depth" className="text-sm font-medium">
            Learning depth
          </label>
          <select
            id="generation-depth"
            value={form.depth}
            onChange={(event) =>
              setForm({
                ...form,
                depth: event.target.value as Settings["depth"],
              })
            }
            className={selectClass}
          >
            <option value="beginner">
              Beginner · terminology and intuition
            </option>
            <option value="balanced">Balanced · practical explanations</option>
            <option value="advanced">
              Advanced · tradeoffs and edge cases
            </option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="generation-sources" className="text-sm font-medium">
            Source conversations
          </label>
          <input
            id="generation-sources"
            type="number"
            required
            min={1}
            max={12}
            value={form.sourceLimit}
            onChange={(event) =>
              setForm({ ...form, sourceLimit: Number(event.target.value) })
            }
            className={selectClass}
          />
          <p className="text-xs text-muted-foreground">
            Latest 1–12 top-level chats per project. Existing topics are kept.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.useFeedback}
            onChange={(event) =>
              setForm({ ...form, useFeedback: event.target.checked })
            }
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            Personalize with likes and comments
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              When off, feedback stays saved but isn’t used for generation.
            </span>
          </span>
        </label>
        <Button type="submit" className="h-10 w-full">
          {busy && <LoaderCircle className="animate-spin" />}Save settings
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 text-xs text-muted-foreground"
          onClick={() => void save(true)}
        >
          Restore defaults
        </Button>
      </fieldset>
      {feedback && (
        <p
          role={feedback.error ? "alert" : "status"}
          className={`text-sm ${feedback.error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {feedback.text}
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Applies across this installation from the next run. Existing content is
        kept.
      </p>
      <Link
        href={`/generation${query}`}
        className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium"
      >
        Generation insights
        <ArrowUpRight className="size-4" />
      </Link>
    </form>
  )
}

export function RefreshGenerationInsights() {
  const router = useRouter()
  return (
    <Button type="button" variant="outline" onClick={() => router.refresh()}>
      Refresh
    </Button>
  )
}
