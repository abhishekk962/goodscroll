import { ProjectContentFeed } from "@/components/social/project-content-feed"

export default async function ReelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProjectContentFeed kind="reel" contentID={id} />
}
