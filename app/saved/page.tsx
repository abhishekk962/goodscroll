import type { Metadata } from "next"
import { MediaGrid } from "@/components/social/media-grid"
import { PageHeading } from "@/components/social/page-heading"
import { savedItems } from "@/data/social"

export const metadata: Metadata = { title: "Saved" }

export default function SavedPage() {
  return (
    <section>
      <PageHeading title="Saved" />
      <MediaGrid items={savedItems} label="Saved posts and reels" />
    </section>
  )
}
