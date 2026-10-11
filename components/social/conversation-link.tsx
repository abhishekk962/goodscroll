import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PersonAvatar } from "@/components/social/person-avatar"
import type { OpenCodeConversation } from "@/lib/opencode"
import { cn } from "@/lib/utils"

export function ConversationLink({
  conversation,
  project,
}: {
  conversation: OpenCodeConversation
  project?: string
}) {
  const latestMessage = conversation.messages.at(-1)

  return (
    <Button
      render={
        <Link
          href={`/messages/${conversation.id}${project ? `?project=${encodeURIComponent(project)}` : ""}`}
        />
      }
      nativeButton={false}
      variant="ghost"
      className="h-auto w-full justify-start gap-3 rounded-xl px-2 py-4 text-left whitespace-normal"
    >
      <PersonAvatar person={conversation.friend} className="size-12" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">
            {conversation.friend.name}
          </span>
          <span className="shrink-0 text-[11px] font-normal text-muted-foreground capitalize">
            {conversation.status}
          </span>
        </span>
        {latestMessage && (
          <span
            className={cn(
              "mt-1 block truncate text-xs font-normal text-muted-foreground",
              conversation.unread && "font-medium text-foreground"
            )}
          >
            {latestMessage.sender === "you" && "You: "}
            {latestMessage.text}
          </span>
        )}
      </span>
      {conversation.unread && (
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            conversation.status === "busy" ? "bg-sky-500" : "bg-amber-500"
          )}
        >
          <span className="sr-only">
            {conversation.status === "busy"
              ? "Session is active"
              : "Session is retrying"}
          </span>
        </span>
      )}
    </Button>
  )
}
