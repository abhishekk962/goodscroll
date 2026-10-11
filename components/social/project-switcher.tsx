"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, LoaderCircle } from "lucide-react"
import type { OpenCodeProject } from "@/lib/opencode"
import { projectLabel, GLOBAL_PROJECT_ID } from "@/lib/project-profile"
import { ProjectAvatar } from "@/components/social/project-avatar"
import { cn } from "@/lib/utils"

export function ProjectSwitcher({
  projects,
  projectID,
}: {
  projects: OpenCodeProject[]
  projectID?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState("")

  async function select(id: string) {
    setPending(id)
    setError("")
    try {
      const response = await fetch("/api/project-select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectID: id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      router.replace("/profile")
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not switch projects."
      )
    } finally {
      setPending(undefined)
    }
  }

  return (
    <div>
      <ul aria-label="Project accounts" className="space-y-1">
        {projects.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              disabled={!!pending}
              aria-pressed={project.id === projectID}
              onClick={() => void select(project.id)}
              className={cn(
                "flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60",
                project.id === projectID && "bg-muted/70"
              )}
            >
              <ProjectAvatar project={project} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {projectLabel(project)}
                </span>
                <span
                  className="block truncate text-xs text-muted-foreground"
                  title={project.worktree}
                >
                  {project.id === GLOBAL_PROJECT_ID
                    ? "Chats outside repository projects"
                    : project.worktree}
                </span>
              </span>
              {pending === project.id ? (
                <LoaderCircle
                  aria-label="Switching project"
                  className="size-4 animate-spin"
                />
              ) : (
                project.id === projectID && (
                  <Check
                    aria-label="Selected project"
                    className="size-5 text-primary"
                  />
                )
              )}
            </button>
          </li>
        ))}
      </ul>
      {!projects.length && (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          No projects available. Connect your server below, then add a
          repository folder.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
