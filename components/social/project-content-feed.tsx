import {
  getConnectionSettings,
  selectedProjectID,
  serverKey,
} from "@/lib/browser-settings"
import { GeneratedFeed } from "@/components/social/generated-feed"
import type { FeedContent } from "@/lib/content-types"

export async function ProjectContentFeed({
  kind,
  contentID,
}: {
  kind: FeedContent["kind"]
  contentID?: string
}) {
  const identity = `${serverKey((await getConnectionSettings()).baseUrl)}:${await selectedProjectID()}`
  return <GeneratedFeed key={identity} kind={kind} contentID={contentID} />
}
