"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Bookmark, LoaderCircle } from "lucide-react"
import { GeneratedCard } from "@/components/social/generated-feed"
import type { FeedContent } from "@/lib/content-types"

export function SavedFeed() {
  const params = useSearchParams()
  const project = params.get("project") ?? ""
  return <ProjectSavedFeed key={project} project={project} />
}

function ProjectSavedFeed({ project }: { project: string }) {
  const [items, setItems] = useState<FeedContent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [filter, setFilter] = useState<"all" | FeedContent["kind"]>("all")
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(
          `/api/saved${project ? `?project=${encodeURIComponent(project)}` : ""}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        )
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error ?? "Could not load saved content.")
        setItems(data.items)
        setError(null)
        setLoaded(true)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load saved content."
          )
          setLoaded(true)
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [project, reload])
  const visible = items.filter(
    (item) => filter === "all" || item.kind === filter
  )
  return (
    <div className="pb-5">
      <div
        className="flex gap-2 border-b px-5 py-3"
        aria-label="Filter saved content"
      >
        {(["all", "post", "reel"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-2 text-sm ${filter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {value === "all" ? "All" : value === "post" ? "Posts" : "Reels"}
          </button>
        ))}
      </div>
      {!loaded && (
        <p
          role="status"
          className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" />
          Loading saved items…
        </p>
      )}
      {error && (
        <p role="alert" className="px-5 py-8 text-sm text-destructive">
          {error}
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="ml-2 underline"
          >
            Retry
          </button>
        </p>
      )}
      {loaded && !error && !visible.length && (
        <div
          role="status"
          className="space-y-3 px-5 py-12 text-center text-muted-foreground"
        >
          <Bookmark aria-hidden="true" className="mx-auto size-8" />
          <p className="font-semibold text-foreground">
            {items.length
              ? `No saved ${filter === "post" ? "posts" : "reels"} yet`
              : "No saved items yet"}
          </p>
          <p className="text-sm">Bookmark a post or reel to save it here.</p>
        </div>
      )}
      {visible.map((item) => (
        <div
          key={item.id}
          className={
            item.kind === "reel" ? "h-[calc(100svh-var(--nav-height))]" : ""
          }
        >
          <GeneratedCard
            item={item}
            project={project}
            onSavedChange={(id, saved) => {
              if (!saved)
                setItems((previous) =>
                  previous.filter((entry) => entry.id !== id)
                )
            }}
          />
        </div>
      ))}
    </div>
  )
}
