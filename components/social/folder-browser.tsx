"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUp, File, Folder, Plus } from "lucide-react"
import type { FileNode } from "@opencode-ai/sdk"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Listing = { directory: string; parent: string | null; entries: FileNode[] }

export function FolderBrowser({
  initialDirectory,
  isGlobal = false,
  projectID,
  mode = "folder",
}: {
  initialDirectory?: string
  isGlobal?: boolean
  projectID?: string
  mode?: "folder" | "add"
}) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  if (isGlobal) {
    return (
      <div className="rounded-2xl border p-4">
        <h2 className="text-sm font-medium">Working folder</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Uses the server default. Add a project to choose a folder.
        </p>
      </div>
    )
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {mode === "add" ? (
        <DialogTrigger
          render={<Button variant="outline" className="mt-3 h-11 w-full" />}
        >
          <Plus aria-hidden="true" /> Add project
        </DialogTrigger>
      ) : (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Working folder</h3>
            <p
              className="mt-1 truncate text-sm text-muted-foreground"
              title={initialDirectory}
            >
              {initialDirectory ?? "Server default"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose a folder within this repository.
          </p>
          <DialogTrigger
            render={<Button variant="outline" className="h-10 w-full" />}
          >
            <Folder aria-hidden="true" /> Change folder
          </DialogTrigger>
        </div>
      )}
      <DialogContent className="flex h-[560px] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle>
            {mode === "add" ? "Add project" : "Choose working folder"}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Choose a repository on your OpenCode server."
              : "Choose a folder in this repository. For another repository, use Add project."}
          </DialogDescription>
        </DialogHeader>
        {dialogOpen && (
          <FolderPicker
            initialDirectory={initialDirectory}
            projectID={projectID}
            mode={mode}
            onSelected={() => {
              setDialogOpen(false)
              router.replace(
                mode === "folder" && projectID
                  ? `/profile?project=${encodeURIComponent(projectID)}`
                  : "/profile",
                { scroll: false }
              )
              router.refresh()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FolderPicker({
  initialDirectory,
  onSelected,
  projectID,
  mode,
}: {
  initialDirectory?: string
  onSelected: () => void
  projectID?: string
  mode: "folder" | "add"
}) {
  const [target, setTarget] = useState(initialDirectory)
  const [path, setPath] = useState(initialDirectory ?? "")
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)

  function open(directory?: string) {
    setLoading(true)
    setError("")
    setTarget(directory)
    setReload((value) => value + 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    const query = target ? `?directory=${encodeURIComponent(target)}` : ""
    async function load() {
      try {
        const response = await fetch(`/api/folders${query}`, {
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        if (controller.signal.aborted) return
        setListing(data)
        setPath(data.directory)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setListing(null)
          setError(
            cause instanceof Error ? cause.message : "Could not load folders."
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [target, reload])

  async function select() {
    if (!listing || loading) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directory: listing.directory,
          action: mode,
          projectID,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      onSelected()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not select folder."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <form
        className="flex shrink-0 gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          open(path)
        }}
      >
        <Input
          aria-label="Server folder path"
          placeholder="Folder path on the server"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          disabled={saving}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={loading || saving || !path.trim()}
        >
          Open
        </Button>
      </form>
      <div className="flex h-8 shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Open parent folder"
          disabled={loading || !listing?.parent || saving}
          onClick={() => open(listing?.parent ?? undefined)}
        >
          <ArrowUp />
        </Button>
        <p
          className="min-w-0 truncate text-xs text-muted-foreground"
          title={listing?.directory}
        >
          {listing?.directory ?? target ?? "Server default"}
        </p>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border"
        aria-busy={loading}
      >
        {loading ? (
          <p role="status" className="p-3 text-sm text-muted-foreground">
            Loading folder…
          </p>
        ) : (
          listing && (
            <ul aria-label="Files and folders" className="divide-y">
              {listing.entries.map((entry) => (
                <li key={entry.absolute}>
                  {entry.type === "directory" ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                      disabled={saving}
                      onClick={() => open(entry.absolute)}
                      title={entry.name}
                    >
                      <Folder
                        aria-hidden="true"
                        className="size-4 shrink-0 text-primary"
                      />
                      <span className="truncate">{entry.name}</span>
                    </button>
                  ) : (
                    <div
                      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"
                      title={entry.name}
                    >
                      <File aria-hidden="true" className="size-4 shrink-0" />
                      <span className="truncate">{entry.name}</span>
                    </div>
                  )}
                </li>
              ))}
              {!listing.entries.length && (
                <li className="px-3 py-4 text-sm text-muted-foreground">
                  This folder is empty.
                </li>
              )}
            </ul>
          )
        )}
      </div>
      <div className="h-10 shrink-0" aria-live="polite">
        {error && (
          <p
            role="alert"
            className="line-clamp-2 text-sm text-destructive"
            title={error}
          >
            {error}
          </p>
        )}
      </div>
      <Button
        className="w-full shrink-0"
        disabled={loading || saving || !listing}
        onClick={select}
      >
        {saving ? "Saving…" : mode === "add" ? "Open as project" : "Use folder"}
      </Button>
    </div>
  )
}
