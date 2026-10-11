"use client"

import { useEffect, useRef, useState } from "react"
import { Heart, MessageCircle, LoaderCircle } from "lucide-react"
import type { PostFeedback as Feedback } from "@/lib/content-types"

export function PostFeedback({ id, project }: { id: string; project: string }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const commentRequest = useRef<{ id: string; body: string } | null>(null)
  const lock = useRef(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const endpoint = `/api/posts/${encodeURIComponent(id)}/feedback${project ? `?project=${encodeURIComponent(project)}` : ""}`

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error ?? "Could not load feedback.")
        setFeedback(data)
        setError(null)
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Could not load feedback."
          )
      }
    }
    void load()
    return () => controller.abort()
  }, [endpoint, reload])

  async function save(method: "PUT" | "POST", body: object) {
    if (lock.current) return
    lock.current = true
    setPending(true)
    setError(null)
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error ?? "Could not save feedback.")
      setFeedback(data)
      if (method === "POST") {
        setDraft("")
        commentRequest.current = null
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save feedback."
      )
    } finally {
      lock.current = false
      setPending(false)
    }
  }

  return (
    <div className="space-y-3 px-5 pb-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={feedback?.liked ? "Unlike post" : "Like post"}
          aria-pressed={feedback?.liked ?? false}
          disabled={pending || !feedback}
          onClick={() => void save("PUT", { liked: !feedback?.liked })}
          className="rounded-full p-1 disabled:opacity-50"
        >
          <Heart
            className={`size-6 ${feedback?.liked ? "fill-rose-500 text-rose-500" : ""}`}
          />
        </button>
        <button
          type="button"
          aria-label="Comment on post"
          aria-expanded={expanded}
          aria-controls={`comments-${id}`}
          onClick={() => {
            setExpanded((value) => !value)
            if (!expanded) setTimeout(() => input.current?.focus(), 0)
          }}
          className="rounded-full p-1"
        >
          <MessageCircle className="size-6" />
        </button>
        {pending && (
          <LoaderCircle
            aria-label="Saving feedback"
            className="size-4 animate-spin text-muted-foreground"
          />
        )}
      </div>
      {feedback?.liked && <p className="text-sm font-semibold">Liked by you</p>}
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={`comments-${id}`}
        className="text-sm text-muted-foreground"
      >
        {feedback?.commentCount
          ? `View ${feedback.commentCount} ${feedback.commentCount === 1 ? "comment" : "comments"}`
          : "Add a comment"}
      </button>
      {expanded && (
        <div id={`comments-${id}`} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Your likes and comments help shape future posts.
          </p>
          <div
            className="max-h-64 space-y-3 overflow-y-auto"
            aria-live="polite"
          >
            {feedback?.comments.map((comment) => (
              <p
                key={comment.id}
                className="text-sm leading-relaxed break-words whitespace-pre-wrap"
              >
                <span className="mr-2 font-semibold">You</span>
                {comment.body}
              </p>
            ))}
          </div>
          <form
            className="flex items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const body = draft.trim()
              if (!body || pending || !feedback) return
              if (commentRequest.current?.body !== body)
                commentRequest.current = { id: crypto.randomUUID(), body }
              void save("POST", commentRequest.current)
            }}
          >
            <textarea
              ref={input}
              aria-label="Add a comment"
              placeholder="Add a comment…"
              rows={2}
              maxLength={1000}
              value={draft}
              disabled={pending}
              onChange={(event) => setDraft(event.target.value)}
              className="min-w-0 flex-1 resize-none rounded-lg border bg-transparent p-2 text-sm"
            />
            <button
              type="submit"
              disabled={!draft.trim() || pending || !feedback}
              className="py-2 text-sm font-semibold text-primary disabled:opacity-40"
            >
              Post
            </button>
          </form>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
          {!feedback && (
            <button
              type="button"
              onClick={() => setReload((value) => value + 1)}
              className="ml-2 underline"
            >
              Retry
            </button>
          )}
        </p>
      )}
    </div>
  )
}
