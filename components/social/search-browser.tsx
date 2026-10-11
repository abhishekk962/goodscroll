"use client"

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react"
import { NativePage } from "@/components/social/native-page"
import type { NativeBrowserState } from "@/lib/native-browser"
import Image from "next/image"
import { Streamdown } from "streamdown"
import { publicWebURL } from "@/lib/web-url"
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe,
  LoaderCircle,
  RotateCw,
  Search,
  X,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Result = { url: string; title: string; description?: string }
type Visit = Result & { id: string; visitedAt: number; hasSnapshot: boolean }
const subscribeNative = () => () => {}

async function json(response: Response) {
  const data = await response.json()
  if (!response.ok)
    throw new Error(data.error ?? "Something went wrong. Try again.")
  return data
}

export function SearchBrowser() {
  const native = useSyncExternalStore(
    subscribeNative,
    () => window.goodscrollBrowser ?? null,
    () => null
  )
  const [nativeState, setNativeState] = useState<NativeBrowserState | null>(
    null
  )
  const [query, setQuery] = useState("")
  const [searched, setSearched] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trail, setTrail] = useState<Result[]>([])
  const [position, setPosition] = useState(-1)
  const [address, setAddress] = useState("")
  const [reader, setReader] = useState(true)
  const [markdown, setMarkdown] = useState("")
  const [capturing, setCapturing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const searchRequest = useRef<AbortController | null>(null)
  const visitRequest = useRef(0)
  const historyReady = useRef<Promise<void> | null>(null)
  const lastNativeURL = useRef("")
  const active = trail[position]

  useEffect(() => {
    historyReady.current = fetch("/api/browser")
      .then(json)
      .then((data) => setVisits(data.visits))
      .catch(() => setError("Could not load recent sites."))
    return () => {
      searchRequest.current?.abort()
      visitRequest.current = -1
    }
  }, [])

  useEffect(() => {
    if (!native) return
    const stateSubscription = native.onState((state) => {
      setNativeState(state)
      if (state.url) {
        setTrail([
          { url: state.url, title: state.title || new URL(state.url).hostname },
        ])
        setPosition(0)
        setAddress(state.url)
        if (lastNativeURL.current !== state.url) {
          lastNativeURL.current = state.url
          void (async () => {
            try {
              await historyReady.current
              const data = await fetch("/api/browser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  url: state.url,
                  title: state.title,
                  recordOnly: true,
                }),
              }).then(json)
              setVisits(data.visits)
            } catch {
              /* Keep navigation usable if local history is unavailable. */
            }
          })()
        }
      }
    })
    const snapshotSubscription = native.onSnapshot((snapshot) => {
      void (async () => {
        try {
          await historyReady.current
          const data = await fetch("/api/browser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(snapshot),
          }).then(json)
          setVisits(data.visits)
        } catch {
          setPreviewError("Could not save preview.")
        }
      })()
    })
    return () => {
      stateSubscription()
      snapshotSubscription()
      void native.command("close").catch(() => {})
    }
  }, [native])

  async function capture(page: Result, refresh = false, recordOnly = false) {
    const requestID = ++visitRequest.current
    setCapturing(true)
    setMarkdown("")
    setPreviewError(null)
    try {
      await historyReady.current
      const data = await fetch("/api/browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...page, refresh, recordOnly }),
      }).then(json)
      setVisits(data.visits)
      // History may include several completed visits; reader content belongs only to the current page.
      if (requestID === visitRequest.current) {
        setMarkdown(data.markdown)
        setPreviewError(data.snapshotError)
      }
    } catch (cause) {
      if (requestID === visitRequest.current)
        setPreviewError(
          cause instanceof Error ? cause.message : "Preview unavailable."
        )
    } finally {
      if (requestID === visitRequest.current) setCapturing(false)
    }
  }

  function open(page: Result) {
    setTrail((current) => [...current.slice(0, position + 1), page])
    setPosition(position + 1)
    setAddress(page.url)
    setReader(!native)
    if (native)
      void native
        .open(page.url)
        .catch(() => setPreviewError("Could not open page. Try Reader."))
    void capture(page, false, Boolean(native))
  }

  function move(next: number) {
    const page = trail[next]
    if (!page) return
    setPosition(next)
    setAddress(page.url)
    setReader(true)
    void capture(page)
  }

  async function close() {
    // Capture while the native view still has a visible display surface.
    if (native) await native.command("close").catch(() => {})
    visitRequest.current++
    setTrail([])
    setPosition(-1)
    setCapturing(false)
    void fetch("/api/browser")
      .then(json)
      .then((data) => setVisits(data.visits))
      .catch(() => {})
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = query.trim()
    if (!value) return
    searchRequest.current?.abort()
    const controller = new AbortController()
    searchRequest.current = controller
    setSearching(true)
    setError(null)
    setSearched(value)
    setResults([])
    try {
      const data = await fetch(`/api/search?q=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      }).then(json)
      setResults(data.results)
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Search unavailable.")
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  function navigate(event: FormEvent) {
    event.preventDefault()
    try {
      const url = publicWebURL(
        /^https?:\/\//i.test(address.trim())
          ? address.trim()
          : `https://${address.trim()}`
      )
      open({ url, title: new URL(url).hostname })
    } catch {
      setPreviewError("Enter a URL, e.g. example.com.")
    }
  }

  return (
    <section className="min-h-[calc(100svh-var(--nav-height))]">
      <div className="px-5 pt-8 pb-5">
        <div className="mb-5 flex items-center gap-2">
          <Globe className="size-5" />
          <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
            />
            <Input
              aria-label="Search the web"
              placeholder="Search the web"
              type="search"
              maxLength={500}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 rounded-xl bg-muted/50 pl-10"
            />
          </div>
          <Button
            type="submit"
            disabled={!query.trim()}
            className="h-11 rounded-xl"
            aria-label="Submit search"
          >
            <Search className="size-4" />
          </Button>
        </form>
      </div>

      {active ? (
        <div className="fixed inset-x-0 top-0 bottom-[var(--nav-height)] z-40 mx-auto flex max-w-[480px] flex-col border-x bg-background">
          <div className="flex items-center gap-1 border-b px-2 py-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back"
              disabled={
                native && !reader ? !nativeState?.canGoBack : position === 0
              }
              onClick={() =>
                native && !reader
                  ? void native.command("back")
                  : move(position - 1)
              }
            >
              <ArrowLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Forward"
              disabled={
                native && !reader
                  ? !nativeState?.canGoForward
                  : position === trail.length - 1
              }
              onClick={() =>
                native && !reader
                  ? void native.command("forward")
                  : move(position + 1)
              }
            >
              <ArrowRight />
            </Button>
            <form onSubmit={navigate} className="min-w-0 flex-1">
              <Input
                aria-label="Website address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="text-xs"
              />
            </form>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh page"
              disabled={capturing}
              onClick={() => {
                if (native && !reader) void native.command("reload")
                else void capture(active, true)
              }}
            >
              <RotateCw className={capturing ? "animate-spin" : ""} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close browser"
              onClick={close}
            >
              <X />
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={reader ? "ghost" : "secondary"}
                disabled={!native}
                title={
                  !native ? "Live browsing requires the desktop app" : undefined
                }
                onClick={() => setReader(false)}
              >
                Live page
              </Button>
              <Button
                size="sm"
                variant={reader ? "secondary" : "ghost"}
                onClick={() => {
                  setReader(true)
                  void capture(active)
                }}
              >
                Reader
              </Button>
            </div>
            <a
              href={active.url}
              onClick={(event) => {
                if (native) {
                  event.preventDefault()
                  void native
                    .external(active.url)
                    .catch(() =>
                      setPreviewError("Could not open your browser.")
                    )
                }
              }}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground"
            >
              Open in browser <ExternalLink className="size-3" />
            </a>
          </div>
          {(previewError || (!reader && nativeState?.error)) && (
            <p
              role="status"
              className="px-3 py-2 text-xs text-muted-foreground"
            >
              {previewError || nativeState?.error}
            </p>
          )}
          {reader ? (
            <article className="min-h-0 flex-1 overflow-y-auto p-5">
              <h2 className="mb-4 text-lg font-semibold">{active.title}</h2>
              {capturing ? (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading page…
                </p>
              ) : (
                <Streamdown
                  mode="static"
                  className="space-y-4 text-sm leading-7 wrap-break-word"
                  components={{
                    a: ({ href, children }) => (
                      <button
                        className="text-primary underline"
                        onClick={() => {
                          try {
                            const url = publicWebURL(
                              new URL(href ?? "", active.url).href
                            )
                            open({ url, title: new URL(url).hostname })
                          } catch {
                            setPreviewError("This link requires a public URL.")
                          }
                        }}
                      >
                        {children}
                      </button>
                    ),
                  }}
                >
                  {markdown ||
                    "Reader unavailable. Refresh or open the live page."}
                </Streamdown>
              )}
            </article>
          ) : native ? (
            <NativePage browser={native} />
          ) : null}
        </div>
      ) : null}

      <div aria-live="polite" className="px-5">
        {searching && (
          <p className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Searching…
          </p>
        )}
        {error && (
          <p role="alert" className="py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {searched && !searching && !error && !results.length && (
          <p className="mb-4 text-xs text-muted-foreground">
            No results for “{searched}”.
          </p>
        )}
      </div>
      {results.length > 0 && (
        <div className="space-y-6 px-5 pb-7">
          {results.map((result, index) => (
            <button
              key={`${result.url}:${index}`}
              onClick={() => open(result)}
              className="group block w-full text-left"
            >
              <p className="mb-1 truncate text-xs text-muted-foreground">
                {new URL(result.url).hostname}{" "}
                <span className="opacity-60">
                  {new URL(result.url).pathname}
                </span>
              </p>
              <h2 className="text-base font-medium text-primary group-hover:underline">
                {result.title || result.url}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {result.description}
              </p>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between border-t px-5 pt-5 pb-3">
        <h2 className="text-sm font-medium">Recent sites</h2>
      </div>
      {visits.length ? (
        <div className="grid grid-cols-2 gap-3 px-5 pb-6">
          {visits.map((visit) => (
            <button
              key={visit.id}
              onClick={() => open(visit)}
              className="overflow-hidden rounded-xl border bg-muted/30 text-left transition-colors hover:border-primary/40"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {visit.hasSnapshot ? (
                  <Image
                    src={`/api/browser?snapshot=${encodeURIComponent(visit.id)}&v=${visit.visitedAt}`}
                    alt={`Saved preview of ${visit.title}`}
                    fill
                    unoptimized
                    sizes="220px"
                    loading="lazy"
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div
                    className="flex h-full items-center justify-center text-muted-foreground"
                    role="img"
                    aria-label="Preview unavailable"
                  >
                    <Globe className="size-7" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{visit.title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {new URL(visit.url).hostname}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          <Globe className="mx-auto mb-3 size-8 opacity-40" />
          <p>Sites you visit appear here.</p>
        </div>
      )}
    </section>
  )
}
