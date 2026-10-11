"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  LoaderCircle,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import type { FeedContent, FeedState } from "@/lib/content-types"
import { PostFeedback } from "@/components/social/post-feedback"
import { SaveButton } from "@/components/social/save-button"

export function GeneratedFeed({
  kind,
  contentID,
}: {
  kind: FeedContent["kind"]
  contentID?: string
}) {
  const params = useSearchParams()
  const project = params.get("project") ?? ""
  return (
    <ProjectFeed
      key={`${project}:${kind}:${contentID}`}
      project={project}
      kind={kind}
      contentID={contentID}
    />
  )
}
function ProjectFeed({
  project,
  kind,
  contentID,
}: {
  project: string
  kind: FeedContent["kind"]
  contentID?: string
}) {
  const [items, setItems] = useState<FeedContent[]>([])
  const [running, setRunning] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topicCount, setTopicCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [generationEnabled, setGenerationEnabled] = useState(true)
  const endpoint = `/api/feed${project ? `?project=${encodeURIComponent(project)}` : ""}`
  const busy = useRef(false)
  const alive = useRef(true)
  const update = useCallback(
    async (seenID?: string) => {
      if (busy.current && !seenID) return false
      if (!seenID) busy.current = true
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(seenID ? { seenID } : {}),
          cache: "no-store",
        })
        const result = (await response.json()) as FeedState
        if (!response.ok)
          throw new Error(result.error ?? "Could not load content")
        if (!alive.current) return false
        setItems((previous) => {
          const known = new Set(previous.map((item) => item.id))
          return [
            ...previous,
            ...[...result.items, ...(result.history ?? [])].filter(
              (item) => !known.has(item.id)
            ),
          ]
        })
        setRunning(result.running)
        setError(result.error)
        setTopicCount(result.topics.length)
        setLoaded(true)
        setGenerationEnabled(result.generationEnabled)
        return true
      } catch (cause) {
        if (alive.current) {
          setError(
            cause instanceof Error ? cause.message : "Could not load content."
          )
          setRunning(false)
          setLoaded(true)
        }
        return false
      } finally {
        if (!seenID) busy.current = false
      }
    },
    [endpoint]
  )
  useEffect(() => {
    alive.current = true
    const initial = setTimeout(() => void update(), 0)
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void update()
    }, 5000)
    return () => {
      alive.current = false
      clearTimeout(initial)
      clearInterval(timer)
    }
  }, [update])
  const visible = items.filter(
    (item) => item.kind === kind && (!contentID || item.id === contentID)
  )
  return (
    <section
      aria-label={kind === "post" ? "Project feed" : "Project reels"}
      className={
        kind === "reel"
          ? "h-[calc(100svh-var(--nav-height))] snap-y snap-mandatory overflow-y-auto"
          : "space-y-5 pb-5"
      }
    >
      {kind === "post" && (
        <header className="sticky top-0 z-20 border-b bg-background/95 px-5 py-4 backdrop-blur-xl">
          <h1 className="text-xl font-semibold">goodscroll.</h1>
          <p className="text-xs text-muted-foreground">
            {topicCount} project topics
          </p>
        </header>
      )}
      {visible.map((item) => (
        <GeneratedCard
          key={item.id}
          item={item}
          project={project}
          onSeen={update}
        />
      ))}
      <div
        className="space-y-3 px-5 py-8 text-sm text-muted-foreground"
        role="status"
      >
        {running && (
          <p className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" />
            Generating content…
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {loaded && !generationEnabled && (
          <p>Generation paused. Resume in Profile → Content generation.</p>
        )}
        {loaded && !running && !error && !visible.length && (
          <p>
            {contentID
              ? "This reel is unavailable or already seen."
              : topicCount
                ? "You’re caught up. New content appears automatically."
                : generationEnabled
                  ? "Start a project chat to build your feed."
                  : "No content yet."}
          </p>
        )}
        {error && (
          <button
            className="rounded-lg border px-4 py-2 text-foreground"
            onClick={() => void update()}
          >
            Retry
          </button>
        )}
      </div>
    </section>
  )
}
export function GeneratedCard({
  item,
  project,
  onSeen,
  onSavedChange,
}: {
  item: FeedContent
  project: string
  onSeen?: (id: string) => Promise<boolean>
  onSavedChange?: (id: string, saved: boolean) => void
}) {
  const element = useRef<HTMLElement>(null)
  const acknowledged = useRef(item.seenAt !== null)
  const sending = useRef(false)
  const [active, setActive] = useState(false)
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const node = element.current
    if (!node) return
    let visible = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const evaluate = () => {
      clearTimeout(timer)
      const watching = visible && document.visibilityState === "visible"
      setActive(watching)
      if (watching && onSeen && !acknowledged.current && !sending.current)
        timer = setTimeout(
          async () => {
            sending.current = true
            acknowledged.current = await onSeen(item.id)
            sending.current = false
            if (!acknowledged.current) evaluate()
          },
          item.kind === "reel" ? 3000 : 1500
        )
    }
    const threshold = Math.min(
      0.6,
      (window.innerHeight * 0.5) / Math.max(node.offsetHeight, 1)
    )
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= threshold
        evaluate()
      },
      { threshold: [0, threshold] }
    )
    observer.observe(node)
    document.addEventListener("visibilitychange", evaluate)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", evaluate)
    }
  }, [item.id, item.kind, onSeen])
  useEffect(() => {
    if (item.kind !== "reel" || !active || paused) return
    const timer = setInterval(
      () => setSlide((value) => (value + 1) % item.slides.length),
      4000
    )
    return () => clearInterval(timer)
  }, [active, paused, item.kind, item.slides.length])
  if (item.kind === "reel")
    return (
      <article
        ref={element}
        aria-label={item.title}
        className="relative flex h-full min-h-[420px] snap-start flex-col justify-between bg-gradient-to-br from-indigo-950 via-slate-900 to-teal-950 p-7 text-white"
      >
        <div>
          <p className="text-xs tracking-widest text-white/60">AI GENERATED</p>
          <h2 className="mt-3 text-xl font-semibold">{item.title}</h2>
        </div>
        <div aria-live="off" className="py-8">
          <p
            key={slide}
            className="text-3xl leading-snug font-medium motion-safe:animate-in motion-safe:fade-in"
          >
            {item.slides[slide]}
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2">
            {item.slides.map((_, index) => (
              <button
                key={index}
                aria-label={`Slide ${index + 1}`}
                aria-pressed={slide === index}
                onClick={() => setSlide(index)}
                className={`h-2 flex-1 rounded-full ${slide === index ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-white/70">
              {slide + 1} / {item.slides.length}
            </p>
            <SaveButton
              item={item}
              project={project}
              onSavedChange={onSavedChange}
            />
            <button
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? "Play reel" : "Pause reel"}
              className="rounded-full border border-white/30 p-3"
            >
              {paused ? (
                <Play className="size-5" />
              ) : (
                <Pause className="size-5" />
              )}
            </button>
          </div>
          <details className="text-sm text-white/70">
            <summary>Read transcript</summary>
            <p className="mt-3 whitespace-pre-wrap">{item.body}</p>
            {item.slides.map((text, index) => (
              <p key={index} className="mt-2">
                {text}
              </p>
            ))}
          </details>
        </div>
      </article>
    )
  return (
    <article
      ref={element}
      aria-label={item.title}
      className="overflow-hidden border-b"
    >
      <header className="flex items-center gap-3 px-5 py-3">
        <div
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 text-sm font-bold text-white"
        >
          g.
        </div>
        <div>
          <p className="text-sm font-semibold">goodscroll</p>
          <p className="text-xs text-muted-foreground">
            AI generated
          </p>
        </div>
      </header>
      <div className="relative flex aspect-square flex-col justify-center bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-teal-500/20 p-8 sm:p-10">
        <p className="mb-5 shrink-0 text-xs font-semibold tracking-widest text-muted-foreground">
          {item.slides.length
            ? `LEARN SOMETHING · ${slide + 1} / ${item.slides.length}`
            : "LEARN SOMETHING"}
        </p>
        <h2
          className={
            item.slides.length
              ? "mb-4 shrink-0 text-sm font-semibold text-muted-foreground"
              : "text-3xl leading-tight font-semibold"
          }
        >
          {item.title}
        </h2>
        {item.slides.length > 0 && (
          <p
            className="min-h-0 overflow-y-auto text-xl leading-snug font-semibold break-words sm:text-2xl"
            aria-live="polite"
          >
            {item.slides[slide]}
          </p>
        )}
        {item.slides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              disabled={slide === 0}
              onClick={() => setSlide((value) => value - 1)}
              className="absolute top-1/2 left-2 rounded-full bg-background/80 p-1 disabled:opacity-20"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              disabled={slide === item.slides.length - 1}
              onClick={() => setSlide((value) => value + 1)}
              className="absolute top-1/2 right-2 rounded-full bg-background/80 p-1 disabled:opacity-20"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute right-0 bottom-5 left-0 flex justify-center gap-2">
              {item.slides.map((_, index) => (
                <button
                  type="button"
                  key={index}
                  aria-label={`Slide ${index + 1}`}
                  aria-pressed={slide === index}
                  onClick={() => setSlide(index)}
                  className={`size-2 rounded-full ${index === slide ? "bg-primary" : "bg-foreground/20"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <p className="px-5 pt-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap">
        <span className="mr-2 font-semibold">goodscroll</span>
        {item.body}
      </p>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <PostFeedback id={item.id} project={project} />
        </div>
        <div className="pr-5">
          <SaveButton
            item={item}
            project={project}
            onSavedChange={onSavedChange}
          />
        </div>
      </div>
    </article>
  )
}
