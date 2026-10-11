import type { Metadata } from "next"
import { SavedFeed } from "@/components/social/saved-feed"
import { PageHeading } from "@/components/social/page-heading"
import {
  getConnectionSettings,
  selectedProjectID,
  serverKey,
} from "@/lib/browser-settings"

export const metadata: Metadata = { title: "Saved" }

export default async function SavedPage() {
  const identity = `${serverKey((await getConnectionSettings()).baseUrl)}:${await selectedProjectID()}`
  return (
    <section>
      <PageHeading title="Saved" />
      <SavedFeed key={identity} />
    </section>
  )
}
