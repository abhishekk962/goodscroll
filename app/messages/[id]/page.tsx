import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConversationCard } from "@/components/social/conversation-card"
import {
  getOpenCodeConversation,
  getOpenCodeModels,
  getOpenCodeSelection,
} from "@/lib/opencode"
import { PersonAvatar } from "@/components/social/person-avatar"
import { ModelSelector } from "@/components/social/model-selector"
import {
  defaultConnection,
  getConnectionSettings,
  getProjectSettings,
  serverKey,
} from "@/lib/browser-settings"
import { chatModelKey } from "@/lib/project-profile"

type ConversationPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ project?: string }>
}

export async function generateMetadata({
  params,
  searchParams,
}: ConversationPageProps): Promise<Metadata> {
  const { id } = await params
  const selection = await getOpenCodeSelection((await searchParams).project)
  const conversation = selection.error
    ? undefined
    : await getOpenCodeConversation(id, selection.project?.id)
  return {
    title: conversation
      ? `Messages · ${conversation.friend.name}`
      : "Conversation not found",
  }
}

export default async function ConversationPage({
  params,
  searchParams,
}: ConversationPageProps) {
  const { id } = await params
  const selection = await getOpenCodeSelection((await searchParams).project)
  if (selection.error)
    return (
      <div className="space-y-3 p-5">
        <p role="alert" className="text-sm">
          {selection.error}
        </p>
        <Link href="/profile" className="text-sm underline">
          Open account settings
        </Link>
      </div>
    )
  const project = selection.project?.id
  const conversation = await getOpenCodeConversation(id, project)
  if (!conversation) notFound()
  const models = await getOpenCodeModels(project)
  const preferences = project ? await getProjectSettings(project) : {}
  const storageKey = chatModelKey(
    serverKey((await getConnectionSettings()).baseUrl),
    project ?? "global",
    id
  )
  const legacyStorageKey =
    serverKey((await getConnectionSettings()).baseUrl) ===
    serverKey(defaultConnection().baseUrl)
      ? `goodscroll:model:${id}`
      : undefined

  return (
    <div className="flex h-[calc(100svh-var(--nav-height))] flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-3">
        <Button
          render={
            <Link
              href={
                project
                  ? `/messages?project=${encodeURIComponent(project)}`
                  : "/messages"
              }
            />
          }
          nativeButton={false}
          variant="ghost"
          className="size-9 shrink-0 rounded-full p-0"
          aria-label="Back to messages"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </Button>
        <Link
          href={`/profile${project ? `?project=${encodeURIComponent(project)}` : ""}`}
          aria-label="View project account"
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <PersonAvatar
            person={conversation.friend}
            className="size-8 shrink-0"
          />
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold"
              title={conversation.friend.name}
            >
              {conversation.friend.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{conversation.friend.username}
            </p>
          </div>
        </Link>
        <ModelSelector
          models={models}
          storageKey={storageKey}
          projectModel={preferences.model}
          legacyStorageKey={legacyStorageKey}
          currentModel={conversation.model}
        />
      </div>
      <h1 className="sr-only">Conversation with {conversation.friend.name}</h1>
      <ConversationCard
        key={storageKey}
        conversation={conversation}
        project={project}
        models={models}
        modelStorageKey={storageKey}
        legacyModelStorageKey={legacyStorageKey}
      />
    </div>
  )
}
