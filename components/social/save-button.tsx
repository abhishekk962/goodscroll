"use client"

import { useRef, useState } from "react"
import { Bookmark, LoaderCircle } from "lucide-react"
import type { FeedContent } from "@/lib/content-types"

export function SaveButton({
  item,
  project,
  onSavedChange,
}: {
  item: FeedContent
  project: string
  onSavedChange?: (id: string, saved: boolean) => void
}) {
  const [saved, setSaved] = useState(item.saved ?? false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)
  async function toggle() {
    if (lock.current) return
    lock.current = true
    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/saved${project ? `?project=${encodeURIComponent(project)}` : ""}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, saved: !saved }),
        }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Could not save content.")
      setSaved(data.saved)
      onSavedChange?.(item.id, data.saved)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save content."
      )
    } finally {
      lock.current = false
      setPending(false)
    }
  }
  return (
    <div className="text-right">
      <button
        type="button"
        aria-label={`${saved ? "Unsave" : "Save"} ${item.kind}`}
        aria-pressed={saved}
        disabled={pending}
        onClick={() => void toggle()}
        className="rounded-full p-2 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
        ) : (
          <Bookmark
            aria-hidden="true"
            className={`size-6 ${saved ? "fill-current" : ""}`}
          />
        )}
      </button>
      {error && (
        <p role="alert" className="max-w-60 text-xs">
          {error} Try again.
        </p>
      )}
    </div>
  )
}
