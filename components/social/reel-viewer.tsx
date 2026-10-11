import { ReelCard } from "@/components/social/reel-card"
import type { Reel } from "@/data/social"

export function ReelViewer({ reels }: { reels: Reel[] }) {
  return (
    <section
      aria-label="Reels"
      tabIndex={0}
      className="h-[calc(100svh-var(--nav-height))] snap-y snap-mandatory overflow-y-auto overscroll-y-contain outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <h1 className="sr-only">Reels</h1>
      {reels.map((reel) => (
        <ReelCard key={reel.id} reel={reel} />
      ))}
    </section>
  )
}
