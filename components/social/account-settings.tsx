"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { LoaderCircle, PlugZap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { OpenCodeModel } from "@/lib/opencode"

type ConnectionForm = {
  baseUrl: string
  username: string
  authenticated: boolean
  timeoutSeconds: number
  hasPassword: boolean
}

async function save(body: unknown) {
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? "Could not save settings.")
  return data as { message: string }
}

export function ConnectionSettings({
  initial,
  defaults,
}: {
  initial: ConnectionForm
  defaults: Omit<ConnectionForm, "hasPassword">
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [password, setPassword] = useState("")
  const [replacePassword, setReplacePassword] = useState(false)
  const [busy, setBusy] = useState<string>()
  const [feedback, setFeedback] = useState<{ error?: boolean; text: string }>()

  async function submit(action: "save" | "test", reset = false) {
    setBusy(action)
    setFeedback(undefined)
    try {
      const result = await save({
        scope: "app",
        action,
        ...form,
        password: replacePassword ? password : undefined,
        reset,
      })
      setFeedback({ text: result.message })
      if (action === "save") {
        // A new connection can have entirely different projects and models.
        if (reset) setForm({ ...defaults, hasPassword: false })
        else
          setForm({
            ...form,
            hasPassword:
              form.authenticated &&
              (replacePassword ? !!password : form.hasPassword),
          })
        setPassword("")
        setReplacePassword(false)
        router.replace("/profile", { scroll: false })
        router.refresh()
      }
    } catch (cause) {
      setFeedback({
        error: true,
        text: cause instanceof Error ? cause.message : "Could not connect.",
      })
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit("save")
      }}
      className="space-y-4"
    >
      <fieldset disabled={!!busy} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="server-url" className="text-sm font-medium">
            OpenCode server URL
          </label>
          <Input
            id="server-url"
            type="url"
            required
            maxLength={1024}
            value={form.baseUrl}
            onChange={(event) =>
              setForm({ ...form, baseUrl: event.target.value })
            }
            placeholder={defaults.baseUrl}
            className="h-11"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Used by every project in this browser. The server must be reachable
            from Goodscroll.
          </p>
        </div>
        <details
          className="rounded-xl border px-3 py-3"
          open={form.authenticated || undefined}
        >
          <summary className="cursor-pointer text-sm font-medium">
            Advanced connection settings
          </summary>
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.authenticated}
                onChange={(event) =>
                  setForm({ ...form, authenticated: event.target.checked })
                }
                className="size-4 accent-primary"
              />{" "}
              Use server authentication
            </label>
            {form.authenticated && (
              <>
                <div className="space-y-2">
                  <label htmlFor="server-username" className="text-sm">
                    Username
                  </label>
                  <Input
                    id="server-username"
                    autoComplete="username"
                    maxLength={128}
                    value={form.username}
                    onChange={(event) =>
                      setForm({ ...form, username: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="server-password" className="text-sm">
                    Password
                  </label>
                  <Input
                    id="server-password"
                    type="password"
                    autoComplete="new-password"
                    maxLength={512}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setReplacePassword(true)
                    }}
                    placeholder={
                      form.hasPassword
                        ? "Saved password • enter to replace"
                        : "Server password"
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.hasPassword
                      ? "Leave unchanged to keep the saved password. Disable authentication to remove it."
                      : "Use the password configured on your OpenCode server."}
                  </p>
                </div>
              </>
            )}
            <div className="space-y-2">
              <label htmlFor="server-timeout" className="text-sm">
                Request timeout (seconds)
              </label>
              <Input
                id="server-timeout"
                type="number"
                min={1}
                max={60}
                required
                value={form.timeoutSeconds}
                onChange={(event) =>
                  setForm({
                    ...form,
                    timeoutSeconds: Number(event.target.value),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                For loading data and sending requests. Live chat streams stay
                connected.
              </p>
            </div>
          </div>
        </details>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-10 flex-1">
            {busy === "save" && <LoaderCircle className="animate-spin" />} Save
            connection
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1"
            onClick={(event) => {
              if (event.currentTarget.form?.reportValidity())
                void submit("test")
            }}
          >
            {busy === "test" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <PlugZap />
            )}{" "}
            Test connection
          </Button>
        </div>
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 text-xs text-muted-foreground"
          onClick={() => void submit("save", true)}
        >
          Restore connection defaults
        </Button>
      </fieldset>
      {feedback && (
        <p
          role={feedback.error ? "alert" : "status"}
          className={
            feedback.error
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {feedback.text}
        </p>
      )}
    </form>
  )
}

export function ProjectModelSettings({
  projectID,
  models,
  initialModel,
}: {
  projectID: string
  models: OpenCodeModel[]
  initialModel?: string
}) {
  const router = useRouter()
  const [model, setModel] = useState(initialModel ?? "")
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ error?: boolean; text: string }>()
  const unavailable =
    !!initialModel && !models.some((item) => item.id === initialModel)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFeedback(undefined)
    try {
      const result = await save({
        scope: "project",
        projectID,
        model: model || null,
      })
      setFeedback({ text: result.message })
      router.refresh()
    } catch (cause) {
      setFeedback({
        error: true,
        text: cause instanceof Error ? cause.message : "Could not save model.",
      })
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 border-t pt-4">
      <label htmlFor="project-model" className="text-sm font-medium">
        Default model
      </label>
      <select
        id="project-model"
        value={model}
        onChange={(event) => setModel(event.target.value)}
        disabled={busy}
        className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
      >
        <option value="">Use OpenCode default</option>
        {unavailable && (
          <option value={initialModel} disabled>
            {initialModel} (unavailable)
          </option>
        )}
        {[...new Set(models.map((item) => item.provider))].map((provider) => (
          <optgroup key={provider} label={provider}>
            {models
              .filter((item) => item.provider === provider)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Applies only to this project when a chat has no model override. Choose
        “Use project default” in a chat to inherit this setting.
      </p>
      {unavailable && (
        <p className="text-xs text-destructive">
          The saved model is unavailable. Choose another model or use OpenCode
          default.
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={
          busy || (!!model && !models.some((item) => item.id === model))
        }
        className="h-10 w-full"
      >
        {busy && <LoaderCircle className="animate-spin" />} Save project default
      </Button>
      {feedback && (
        <p
          role={feedback.error ? "alert" : "status"}
          className={
            feedback.error
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {feedback.text}
        </p>
      )}
    </form>
  )
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="space-y-2 border-t pt-4">
      <label htmlFor="appearance" className="text-sm font-medium">
        Appearance
      </label>
      <select
        id="appearance"
        value={theme ?? "dark"}
        onChange={(event) => setTheme(event.target.value)}
        className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
      >
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="system">Follow system</option>
      </select>
    </div>
  )
}
