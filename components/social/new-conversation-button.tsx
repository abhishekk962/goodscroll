"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function NewConversationButton({ project }: { project?: string }) {
  const router = useRouter()
  const creating = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function start() {
    if (creating.current) return
    creating.current = true
    setPending(true)
    setError(undefined)
    try {
      const response = await fetch(
        `/api/messages${project ? `?project=${encodeURIComponent(project)}` : ""}`,
        { method: "POST" }
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error ?? "Could not start a conversation.")
      router.push(
        `/messages/${encodeURIComponent(result.id)}?project=${encodeURIComponent(result.project)}`
      )
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not start a conversation."
      )
      creating.current = false
      setPending(false)
    }
  }

  return (
    <>
      <Button
        onClick={start}
        disabled={pending}
        variant="ghost"
        className="h-auto w-full justify-start gap-3 rounded-xl px-2 py-4 text-left whitespace-normal"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border bg-muted">
          {pending ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-5" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            New chat
          </span>
        </span>
      </Button>
      {error && (
        <p role="alert" className="px-2 pb-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  )
}
