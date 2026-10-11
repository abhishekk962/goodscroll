import type { Metadata } from "next"
import { ProjectContentFeed } from "@/components/social/project-content-feed"

export const metadata: Metadata = { title: "Reels" }
export default function ReelsPage() {
  return <ProjectContentFeed kind="reel" />
}
