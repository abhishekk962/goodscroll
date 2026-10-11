import type { Metadata } from "next"
import Link from "next/link"
import { Globe, MessageCircle, Settings2 } from "lucide-react"
import { ProjectSwitcher } from "@/components/social/project-switcher"
import { ProjectAvatar } from "@/components/social/project-avatar"
import {
  AppearanceSettings,
  ConnectionSettings,
  ProjectModelSettings,
} from "@/components/social/account-settings"
import { FolderBrowser } from "@/components/social/folder-browser"
import { Button } from "@/components/ui/button"
import {
  GLOBAL_PROJECT_ID,
  getOpenCodeDirectory,
  getOpenCodeSelection,
  getOpenCodeModels,
} from "@/lib/opencode"
import {
  defaultConnection,
  getConnectionSettings,
  getProjectSettings,
  serverKey,
} from "@/lib/browser-settings"
import { projectLabel } from "@/lib/project-profile"
import { GenerationSettings } from "@/components/social/generation-settings"
import { getGenerationModels } from "@/lib/generation-models"
import { getGenerationSettings } from "@/lib/local-database"

export const metadata: Metadata = { title: "Account" }

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project: queryProjectID } = await searchParams
  const { projects, project, error } =
    await getOpenCodeSelection(queryProjectID)
  const connection = await getConnectionSettings()
  const defaults = defaultConnection()
  const directory = await getOpenCodeDirectory(project)
  const preferences = project ? await getProjectSettings(project.id) : {}
  const models = project ? await getOpenCodeModels(project.id) : []
  const isGlobal = project?.id === GLOBAL_PROJECT_ID
  const name = projectLabel(project)
  const namespace = serverKey(connection.baseUrl)
  const generationSettings = getGenerationSettings()
  let modelError: string | undefined
  const generationModels = project
    ? await getGenerationModels(project.id).catch(() => {
        modelError =
          "Could not load generation models. Check the OpenCode connection."
        return []
      })
    : []

  return (
    <section>
      <header className="flex h-16 items-center justify-between border-b px-5">
        <h1 className="truncate text-lg font-bold">{name}</h1>
        <Button
          render={<a href="#app-settings" />}
          nativeButton={false}
          variant="ghost"
          size="icon"
          aria-label="Go to app settings"
        >
          <Settings2 />
        </Button>
      </header>
      <div className="space-y-6 px-5 py-6">
        <div className="flex items-center gap-5">
          <ProjectAvatar
            project={project}
            className="size-20 [&_span]:text-xl"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">
              {isGlobal ? "Global account" : "Project account"}
            </p>
            <p className="text-xs leading-relaxed break-all text-muted-foreground">
              {isGlobal
                ? "Chats outside repository projects"
                : (project?.worktree ?? "Connect your OpenCode server.")}
            </p>
          </div>
        </div>
        {project && (
          <Button
            render={
              <Link
                href={`/messages?project=${encodeURIComponent(project.id)}`}
              />
            }
            nativeButton={false}
            variant="secondary"
            className="h-10 w-full"
          >
            <MessageCircle /> Open chats
          </Button>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm leading-relaxed"
          >
            {error}{" "}
            <a href="#app-settings" className="font-medium underline">
              App settings
            </a>
          </div>
        )}

        <section aria-labelledby="accounts-heading" className="space-y-3">
          <div>
            <h2 id="accounts-heading" className="font-semibold">
              Switch account
            </h2>
          </div>
          <ProjectSwitcher projects={projects} projectID={project?.id} />
          {!error && <FolderBrowser key={`add:${namespace}`} mode="add" />}
        </section>

        {project && (
          <section
            aria-labelledby="project-settings-heading"
            className="space-y-4 rounded-2xl border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="project-settings-heading" className="font-semibold">
                  Project settings
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Saved in this browser
                </p>
              </div>
            </div>
            <FolderBrowser
              key={`${namespace}:${project.id}:${directory}`}
              initialDirectory={directory}
              projectID={project.id}
              isGlobal={isGlobal}
            />
            <ProjectModelSettings
              key={`${namespace}:${project.id}:${preferences.model}`}
              projectID={project.id}
              models={models}
              initialModel={preferences.model}
            />
          </section>
        )}

        <section
          id="generation-settings"
          aria-labelledby="generation-settings-heading"
          className="scroll-mt-4 space-y-4 rounded-2xl border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="generation-settings-heading" className="font-semibold">
                Content generation
              </h2>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-medium">
              App-wide
            </span>
          </div>
          <GenerationSettings
            initial={generationSettings}
            models={generationModels}
            projectID={project?.id}
            modelError={modelError}
          />
        </section>

        <section
          id="app-settings"
          aria-labelledby="app-settings-heading"
          className="scroll-mt-4 space-y-4 rounded-2xl border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="app-settings-heading"
                className="flex items-center gap-2 font-semibold"
              >
                <Globe className="size-4" /> App settings
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Saved in this browser
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-medium">
              App-wide
            </span>
          </div>
          <ConnectionSettings
            initial={{
              baseUrl: connection.baseUrl,
              authenticated: connection.authenticated,
              username: connection.username,
              timeoutSeconds: connection.timeoutSeconds,
              hasPassword: !!connection.password,
            }}
            defaults={{
              baseUrl: defaults.baseUrl,
              authenticated: defaults.authenticated,
              username: defaults.username,
              timeoutSeconds: defaults.timeoutSeconds,
            }}
          />
          <AppearanceSettings />
        </section>
      </div>
    </section>
  )
}
