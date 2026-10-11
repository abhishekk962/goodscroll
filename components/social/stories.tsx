import Link from "next/link"
import { PersonAvatar } from "@/components/social/person-avatar"
import type { Story } from "@/data/social"
import { cn } from "@/lib/utils"

export function Stories({ stories }: { stories: Story[] }) {
  return (
    <section
      aria-label="Friends' stories"
      className="overflow-x-auto border-b px-5 py-4"
    >
      <ul className="flex w-max gap-5">
        {stories.map((story) => (
          <li key={story.id}>
            <Link
              href={`/reels/${story.reelId}`}
              aria-label={`View ${story.friend.name}'s story`}
              className="flex w-16 flex-col items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div
                className={cn(
                  "rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]",
                  story.seen && "bg-border bg-none"
                )}
              >
                <div className="rounded-full bg-background p-[3px]">
                  <PersonAvatar person={story.friend} className="size-14" />
                </div>
              </div>
              <span className="w-full truncate text-center text-xs">
                {story.friend.name}
              </span>
              <span className="sr-only">
                {story.seen ? "Viewed story" : "New story"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
