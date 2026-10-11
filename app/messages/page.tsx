import type { Metadata } from "next"
import Link from "next/link"
import { ConversationLink } from "@/components/social/conversation-link"
import { PageHeading } from "@/components/social/page-heading"
import { getOpenCodeConversations, getOpenCodeSelection } from "@/lib/opencode"
import { NewConversationButton } from "@/components/social/new-conversation-button"

export const metadata: Metadata = { title: "Messages" }

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  const selection = await getOpenCodeSelection(project)
  const selectedProject = selection.project?.id
  const conversations = selection.error
    ? []
    : await getOpenCodeConversations(selectedProject)
  return (
    <section>
      <PageHeading title="Messages" />
      {selection.error && (
        <div role="alert" className="space-y-2 px-5 pb-5 text-sm">
          <p>{selection.error}</p>
          <Link href="/profile#app-settings" className="underline">
            Connection settings
          </Link>
        </div>
      )}
      <ul aria-label="Friends and conversations" className="px-3">
        <li>
          {!selection.error && (
            <NewConversationButton project={selectedProject} />
          )}
        </li>
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <ConversationLink
              conversation={conversation}
              project={selectedProject}
            />
          </li>
        ))}
        {!selection.error && !conversations.length && (
          <li className="px-2 py-12 text-center text-sm text-muted-foreground">
            No chats in this project yet.
          </li>
        )}
      </ul>
    </section>
  )
}
